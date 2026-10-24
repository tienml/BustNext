<?php

declare(strict_types=1);

namespace App\Domain\Gtfs\CsvReader;

use Generator;
use RuntimeException;

/**
 * Streaming reader for GTFS CSV files.
 *
 * GTFS feeds are frequently tens of megabytes, so rows are yielded one at a
 * time instead of being collected into an array. The reader is deliberately
 * strict: a GTFS file whose rows do not match its own header is corrupt, and
 * silently skipping those rows would import a partial network that looks
 * healthy. Callers get an exception with the file name and line number.
 */
final class CsvReader
{
    /** RFC 4180 quote character used by GTFS. */
    private const QUOTE = '"';

    /** PHP 8.4 deprecates the default fgetcsv() escape; GTFS never escapes with a backslash. */
    private const ESCAPE = '';

    /**
     * @return Generator<int, array<string, string>, void, void> rows keyed by header name
     */
    public function rows(string $path): Generator
    {
        if (!is_file($path) || !is_readable($path)) {
            throw new RuntimeException("Cannot read GTFS file: {$path}");
        }

        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new RuntimeException("Cannot open GTFS file: {$path}");
        }

        try {
            [$header, $line] = $this->readHeader($handle, $path);
            if ($header === null) {
                return;
            }

            while (($values = fgetcsv($handle, null, ',', self::QUOTE, self::ESCAPE)) !== false) {
                $line++;

                if ($this->isBlank($values)) {
                    continue;
                }

                if (count($values) !== count($header)) {
                    throw new RuntimeException(sprintf(
                        'Column count mismatch in %s on line %d: expected %d columns, found %d',
                        basename($path),
                        $line,
                        count($header),
                        count($values),
                    ));
                }

                $row = [];
                foreach ($header as $index => $column) {
                    $row[$column] = trim((string) $values[$index]);
                }

                yield $row;
            }
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param resource $handle
     * @return array{0: list<string>|null, 1: int}
     */
    private function readHeader($handle, string $path): array
    {
        $header = fgetcsv($handle, null, ',', self::QUOTE, self::ESCAPE);
        if ($header === false || $header === [null]) {
            return [null, 0];
        }

        // A UTF-8 BOM before the first column name would otherwise break every
        // lookup on that column.
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]) ?? (string) $header[0];
        $header = array_map(static fn (string $value): string => trim($value), array_map('strval', $header));

        if (in_array('', $header, true)) {
            throw new RuntimeException("Invalid header in " . basename($path) . ': column names must not be empty');
        }

        if (count($header) !== count(array_unique($header))) {
            throw new RuntimeException("Invalid header in " . basename($path) . ': duplicate column names');
        }

        return [$header, 1];
    }

    /** @param list<string|null> $values */
    private function isBlank(array $values): bool
    {
        if ($values === [null]) {
            return true;
        }

        foreach ($values as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }
}
