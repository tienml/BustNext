<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use Illuminate\Http\UploadedFile;
use App\Models\Dataset;
use Tests\TestCase;
use ZipArchive;

final class GtfsImportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
    }

    public function test_valid_gtfs_zip_is_imported_as_ready_without_replacing_active_version(): void
    {
        $zip = $this->fixtureZip('dataset-a-v1');

        $dataset = Dataset::query()->where('slug', 'hanoi-bus')->firstOrFail();
        $response = $this->post('/api/v1/datasets/' . $dataset->id . '/versions', [
            'file' => $zip,
            'label' => 'Fixture upload',
        ]);

        $response->assertCreated()
            ->assertJsonPath('status', 'ready')
            ->assertJsonPath('version.version_number', 2)
            ->assertJsonPath('version.error_count', 0);

        $version = $response->json('version');
        self::assertSame(40, $version['stats']['stops.txt']);
        self::assertSame(100, $version['stats']['trips.txt']);
        $versionsResponse = $this->getJson('/api/v1/datasets/' . $dataset->id . '/versions');
        $versions = $versionsResponse->json('data.data');
        self::assertSame(['ready', 'active'], array_column($versions, 'status'));
    }

    public function test_invalid_gtfs_zip_becomes_failed_and_active_version_survives(): void
    {
        $dataset = Dataset::query()->where('slug', 'hanoi-bus')->firstOrFail();
        $response = $this->post('/api/v1/datasets/' . $dataset->id . '/versions', [
            'file' => $this->fixtureZip('invalid-references'),
            'label' => 'Invalid fixture',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('status', 'failed');

        self::assertContains('unknown_trip', array_column($response->json('errors'), 'code'));
        $versionsResponse = $this->getJson('/api/v1/datasets/' . $dataset->id . '/versions');
        $versions = $versionsResponse->json('data.data');
        self::assertSame('failed', $versions[0]['status']);
        self::assertSame('active', $versions[1]['status']);
    }

    private function fixtureZip(string $fixture): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'busfast-feed-');
        self::assertNotFalse($path);

        $archive = new ZipArchive();
        self::assertSame(true, $archive->open($path));
        foreach (glob(dirname(__DIR__, 4) . '/fixtures/gtfs/' . $fixture . '/*.txt') ?: [] as $file) {
            $archive->addFile($file, basename($file));
        }
        $archive->close();

        $content = file_get_contents($path);
        @unlink($path);
        self::assertIsString($content);

        return UploadedFile::fake()->createWithContent($fixture . '.zip', $content);
    }
}
