<?php

declare(strict_types=1);

namespace App\Domain\Gtfs\Parser;

use RuntimeException;
use ZipArchive;

/**
 * Extracts an uploaded GTFS archive without trusting its contents.
 *
 * An untrusted ZIP is the classic delivery vehicle for two attacks: a path
 * traversal entry that writes outside the destination, and a "zip bomb" whose
 * declared sizes are small while the expanded output is enormous. Both are
 * blocked here. The byte budget is enforced against the bytes actually
 * streamed to disk, because the size fields in the archive header are
 * attacker-controlled and can understate the real expansion.
 */
final class SafeZipExtractor
{
    private const CHUNK_BYTES = 262_144;

    public function __construct(
        private readonly int $maxEntries = 200,
        private readonly int $maxUncompressedBytes = 200 * 1024 * 1024,
        private readonly int $maxCompressionRatio = 200,
    ) {
    }

    /**
     * Extract to $destination and return the extracted file names.
     *
     * @return list<string>
     */
    public function extract(string $zipPath, string $destination): array
    {
        if (!is_file($zipPath)) {
            throw new RuntimeException('The uploaded file is not a valid ZIP archive.');
        }

        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::RDONLY) !== true) {
            throw new RuntimeException('The uploaded file is not a valid ZIP archive.');
        }

        try {
            if ($zip->numFiles === 0) {
                throw new RuntimeException('The ZIP archive is empty.');
            }
            if ($zip->numFiles > $this->maxEntries) {
                throw new RuntimeException("ZIP contains too many entries ({$zip->numFiles}).");
            }

            $this->ensureDirectory($destination);

            $names = [];
            $seen = [];
            $writtenBytes = 0;

            for ($index = 0; $index < $zip->numFiles; $index++) {
                $name = $this->entryName($zip, $index);
                if (str_ends_with($name, '/')) {
                    continue;
                }

                $relativePath = $this->safeRelativePath($name);
                if (isset($seen[$relativePath])) {
                    throw new RuntimeException('ZIP contains duplicate entry names.');
                }
                $seen[$relativePath] = true;

                $target = $destination . DIRECTORY_SEPARATOR . $relativePath;
                $this->ensureDirectory(dirname($target));
                $writtenBytes += $this->copyEntry($zip, $index, $target, $writtenBytes);

                $names[] = $relativePath;
            }

            if ($names === []) {
                throw new RuntimeException('The ZIP archive does not contain any files.');
            }

            return $names;
        } finally {
            $zip->close();
        }
    }

    private function entryName(ZipArchive $zip, int $index): string
    {
        $name = $zip->getNameIndex($index);
        if ($name === false || $name === '') {
            throw new RuntimeException('ZIP contains an entry without a name.');
        }

        return $name;
    }

    /**
     * Stream one entry to disk, enforcing the expansion budget as bytes land.
     */
    private function copyEntry(ZipArchive $zip, int $index, string $target, int $alreadyWritten): int
    {
        $name = $this->entryName($zip, $index);

        // Cheap pre-check against the declared size so an obvious bomb fails
        // before anything is written. The streamed count below is the real guard.
        $declaredBytes = (int) (($zip->statIndex($index)['size'] ?? 0));
        if ($alreadyWritten + $declaredBytes > $this->maxUncompressedBytes) {
            throw new RuntimeException('ZIP expands beyond the allowed size (possible zip bomb).');
        }

        $stream = $zip->getStream($name);
        if (!is_resource($stream)) {
            throw new RuntimeException('Could not read a ZIP entry.');
        }

        $handle = fopen($target, 'wb');
        if ($handle === false) {
            fclose($stream);
            throw new RuntimeException('Could not write an extracted ZIP entry.');
        }

        $entryBytes = 0;
        try {
            while (!feof($stream)) {
                $chunk = fread($stream, self::CHUNK_BYTES);
                if ($chunk === false) {
                    throw new RuntimeException('Could not read a ZIP entry.');
                }
                if ($chunk === '') {
                    break;
                }

                $entryBytes += strlen($chunk);
                if ($alreadyWritten + $entryBytes > $this->maxUncompressedBytes) {
                    throw new RuntimeException('ZIP expands beyond the allowed size (possible zip bomb).');
                }

                if (fwrite($handle, $chunk) === false) {
                    throw new RuntimeException('Could not write an extracted ZIP entry.');
                }
            }
        } finally {
            fclose($stream);
            fclose($handle);
        }

        $compressedBytes = (int) (($zip->statIndex($index)['comp_size'] ?? 0));
        if ($compressedBytes > 0 && $entryBytes > $compressedBytes * $this->maxCompressionRatio) {
            throw new RuntimeException('ZIP entry has a suspicious compression ratio (possible zip bomb).');
        }

        return $entryBytes;
    }

    /**
     * Validate and normalize an entry name.
     *
     * Rejects absolute paths, parent traversal, NUL bytes and Windows
     * separators or drive letters, all of which could address a file outside
     * $destination. Returns the path with the platform directory separator.
     */
    private function safeRelativePath(string $name): string
    {
        if (str_contains($name, "\0")
            || str_starts_with($name, '/')
            || str_starts_with($name, '\\')
            || str_contains($name, '\\')
            || preg_match('/^[A-Za-z]:/', $name) === 1
        ) {
            throw new RuntimeException('ZIP contains an unsafe entry path.');
        }

        foreach (explode('/', $name) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                throw new RuntimeException('ZIP contains an unsafe entry path.');
            }
        }

        return str_replace('/', DIRECTORY_SEPARATOR, $name);
    }

    private function ensureDirectory(string $directory): void
    {
        if (is_dir($directory)) {
            return;
        }

        if (!mkdir($directory, 0750, true) && !is_dir($directory)) {
            throw new RuntimeException('Could not create extraction directory.');
        }
    }
}
