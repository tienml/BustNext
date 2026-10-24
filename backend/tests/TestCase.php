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
        $this->withoutMiddleware();
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
}
