<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Only throttling is switched off. Route model binding and auth stay on,
        // so tests exercise the same request pipeline as production.
        $this->withoutMiddleware([
            \Illuminate\Routing\Middleware\ThrottleRequests::class,
            \Illuminate\Routing\Middleware\ThrottleRequestsWithRedis::class,
        ]);
    }

    /**
     * Truncate the GTFS tables and load the sample snapshot so every test sees
     * the same network. Kept explicit rather than RefreshDatabase so the suite
     * runs against the real PostgreSQL instance, where the column types matter.
     */
    protected function seedSampleDataset(): void
    {
        foreach (['stop_times', 'trips', 'calendar_dates', 'calendar_services', 'stops', 'routes', 'agencies', 'validation_errors', 'dataset_versions', 'datasets'] as $table) {
            DB::table($table)->delete();
        }

        $this->seed(\Database\Seeders\GtfsSampleSeeder::class);
    }

    /** Authenticate the following requests as an admin account. */
    protected function actingAsAdmin(): \App\Models\User
    {
        $admin = \App\Models\User::query()->firstOrCreate(
            ['email' => 'admin@test.local'],
            ['name' => 'Admin', 'password' => 'password-123'],
        );
        $admin->forceFill(['role' => \App\Models\User::ROLE_ADMIN])->save();
        \Laravel\Sanctum\Sanctum::actingAs($admin);

        return $admin;
    }

    /** Zip one folder of fixtures/gtfs into an upload, as an operator would send it. */
    protected function gtfsFixtureZip(string $fixture): \Illuminate\Http\UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'busfast-feed-');
        self::assertNotFalse($path);

        $archive = new \ZipArchive();
        self::assertSame(true, $archive->open($path, \ZipArchive::OVERWRITE));
        foreach (glob(dirname(__DIR__, 2) . '/fixtures/gtfs/' . $fixture . '/*.txt') ?: [] as $file) {
            $archive->addFile($file, basename($file));
        }
        $archive->close();

        $content = file_get_contents($path);
        @unlink($path);
        self::assertIsString($content);

        return \Illuminate\Http\UploadedFile::fake()->createWithContent($fixture . '.zip', $content);
    }
}
