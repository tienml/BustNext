<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Dataset;
use Tests\TestCase;

/** Real HTTP pipeline, synthetic feed, explicit dates; requires an isolated DB. */
final class GtfsScenarioTest extends TestCase
{
    private Dataset $dataset;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
        $this->actingAsAdmin();
        $this->dataset = Dataset::query()->where('slug', 'hanoi-bus')->firstOrFail();
    }

    public function test_import_validate_activate_and_lookup_including_service_exceptions(): void
    {
        $oldId = (int) $this->dataset->active_version_id;
        $response = $this->post("/api/v1/datasets/{$this->dataset->id}/versions", [
            'file' => $this->gtfsFixtureZip('dataset-a-v1'),
            'label' => 'Scenario 1',
        ])->assertCreated()->assertJsonPath('status', 'ready')
            ->assertJsonPath('version.error_count', 0);
        // Dotted filenames are literal keys, not JSON-path segments.
        self::assertSame(5, $response->json('version.stats')['routes.txt']);
        self::assertSame(40, $response->json('version.stats')['stops.txt']);
        self::assertSame(100, $response->json('version.stats')['trips.txt']);
        $id = (int) $response->json('version.id');
        $this->getJson("/api/v1/versions/{$id}/validation")
            ->assertOk()->assertJsonCount(0, 'data.data');
        self::assertSame($oldId, (int) $this->dataset->fresh()->active_version_id);
        $base = "/api/v1/datasets/{$this->dataset->id}";
        $this->getJson("{$base}/stops/S20")->assertNotFound();

        $this->postJson("/api/v1/versions/{$id}/activate")->assertOk();
        self::assertSame($id, (int) $this->dataset->fresh()->active_version_id);
        $this->getJson("{$base}/stops?limit=100")->assertOk()->assertJsonPath('meta.count', 40);
        $this->getJson("{$base}/routes")->assertOk()->assertJsonPath('meta.count', 5);
        $this->getJson("{$base}/stops/S20/departures?date=2026-10-28&time=08:50:00&limit=1")
            ->assertOk()->assertJsonPath('meta.version', $id)
            ->assertJsonPath('data.0.trip_id', 'T100')
            ->assertJsonPath('data.0.departure_time', '09:01:00')
            ->assertJsonPath('data.0.minutes_until', 11);

        // Sundays are normally inactive. ADD on 1 November must really add trips.
        $this->getJson("{$base}/routes/R1/trips?date=2026-10-25")
            ->assertOk()->assertJsonPath('meta.count', 0);
        $this->getJson("{$base}/routes/R1/trips?date=2026-11-01")
            ->assertOk()->assertJsonPath('meta.count', 20);
        $this->getJson("{$base}/stops/S20/departures?date=2026-11-01&time=08:50:00&limit=1")
            ->assertOk()->assertJsonPath('data.0.trip_id', 'T100')
            ->assertJsonPath('data.0.service_date', '2026-11-01');
        // Saturdays normally run, but REMOVE cancels 31 October.
        $this->getJson("{$base}/routes/R1/trips?date=2026-10-24")
            ->assertOk()->assertJsonPath('meta.count', 20);
        $this->getJson("{$base}/routes/R1/trips?date=2026-10-31")
            ->assertOk()->assertJsonPath('meta.count', 0);

        // Fixture arrival is 25:10, departure is 25:11 (seed uses 25:10 for both).
        $night = $this->getJson("{$base}/stops/S03/departures?date=2026-10-29&time=01:00:00")
            ->assertOk()->json('data');
        $trip = collect($night)->firstWhere('trip_id', 'T001');
        self::assertNotNull($trip);
        self::assertSame('2026-10-28', $trip['service_date']);
        self::assertSame('25:11:00', $trip['departure_time']);
        self::assertSame(11, $trip['minutes_until']);
    }
}
