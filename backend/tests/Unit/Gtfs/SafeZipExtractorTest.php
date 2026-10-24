<?php

declare(strict_types=1);

namespace Tests\Unit\Gtfs;

use App\Domain\Gtfs\Parser\SafeZipExtractor;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use ZipArchive;

final class SafeZipExtractorTest extends TestCase
{
    public function test_it_rejects_path_traversal_entry(): void
    {
        if (!class_exists(ZipArchive::class)) {
            self::markTestSkipped('Zip extension is not installed.');
        }
        $zipPath = tempnam(sys_get_temp_dir(), 'busnext-zip-');
        $zip = new ZipArchive();
        $zip->open($zipPath);
        $zip->addFromString('../escape.txt', 'unsafe');
        $zip->close();

        $this->expectException(RuntimeException::class);
        (new SafeZipExtractor())->extract($zipPath, sys_get_temp_dir() . '/busnext-safe-' . bin2hex(random_bytes(3)));
    }
}
