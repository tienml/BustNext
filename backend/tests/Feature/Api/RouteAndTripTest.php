<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use Illuminate\Support\Facades\Date;
use Tests\TestCase;

final class RouteAndTripTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
    }

    public function test_it_lists_routes_with_agency_name(): void
    {
        $response = $this->getJson('/api/v1/gtfs/routes');

        $response->assertOk()
            ->assertJsonPath('meta.count', 3)
            ->assertJsonPath('data.0.agency_name', 'Transerco Hà Nội');
    }

    public function test_it_filters_routes_by_query(): void
    {
        $this->getJson('/api/v1/gtfs/routes?q=Gia')
            ->assertOk()
            ->assertJsonPath('meta.count', 1)
            ->assertJsonPath('data.0.route_id', '01');
    }

    public function test_route_detail_lists_distinct_stops(): void
    {
        $response = $this->getJson('/api/v1/gtfs/routes/01');

        $response->assertOk()
            ->assertJsonPath('data.short_name', '01')
            ->assertJsonPath('meta.stop_count', 3)
            ->assertJsonPath('meta.trip_count', 2);

        $stopIds = array_column($response->json('stops'), 'stop_id');
        sort($stopIds);
        self::assertSame(['GL001', 'KM001', 'YN001'], $stopIds, 'Each stop of the route must appear once');
    }

    public function test_route_trips_are_filtered_by_active_calendar(): void
    {
        Date::setTestNow('2026-10-24 08:00:00'); // Saturday: WEEKDAY does not run.

        $this->getJson('/api/v1/gtfs/routes/01/trips?date=2026-10-24')
            ->assertOk()
            ->assertJsonPath('meta.count', 0);
    }

    public function test_route_trips_are_ordered_by_first_departure(): void
    {
        $response = $this->getJson('/api/v1/gtfs/routes/01/trips?date=2026-10-22');

        $response->assertOk()->assertJsonPath('meta.count', 2);
        self::assertSame(['TRIP_01_001', 'TRIP_01_002'], array_column($response->json('data'), 'trip_id'));
        self::assertSame('06:00:00', $response->json('data.0.departure_time'));
    }

    public function test_trip_detail_returns_ordered_stop_times_with_raw_and_seconds(): void
    {
        $response = $this->getJson('/api/v1/gtfs/trips/TRIP_07_NIGHT');

        $response->assertOk()
            ->assertJsonPath('data.headsign', 'Bến xe Nước Ngầm')
            ->assertJsonPath('stop_times.1.stop_id', 'KM001')
            ->assertJsonPath('stop_times.1.departure_time', '25:10:00')
            ->assertJsonPath('stop_times.1.departure_seconds', 90600)
            ->assertJsonPath('stop_times.1.stop_name', 'Kim Mã');
    }

    public function test_stop_times_endpoint_and_404_for_unknown_trip(): void
    {
        $this->getJson('/api/v1/gtfs/trips/TRIP_01_001/stop-times')
            ->assertOk()
            ->assertJsonPath('meta.count', 3);

        $this->getJson('/api/v1/gtfs/trips/NOPE/stop-times')
            ->assertNotFound();
    }

    public function test_search_returns_grouped_stops_and_routes(): void
    {
        $response = $this->getJson('/api/v1/search?q=Kim');

        $response->assertOk()
            ->assertJsonPath('meta.counts.stops', 1)
            ->assertJsonPath('data.stops.0.stop_id', 'KM001');
    }

    public function test_dataset_scoped_routes_honour_the_dataset_binding(): void
    {
        $datasetId = \App\Models\Dataset::query()->where('slug', 'hanoi-bus')->value('id');
        $response = $this->getJson("/api/v1/datasets/{$datasetId}/stops");

        $response->assertOk()->assertJsonPath('meta.count', 6);
    }

    public function test_all_dataset_scoped_lookups_match_the_active_global_api(): void
    {
        $dataset = \App\Models\Dataset::query()->where('slug', 'hanoi-bus')->firstOrFail();

        foreach ($this->scopedLookupPaths() as $path) {
            $global = $this->getJson('/api/v1/gtfs' . $path)->assertOk()->json();
            $scoped = $this->getJson("/api/v1/datasets/{$dataset->id}" . $path)
                ->assertOk()->assertJsonPath('meta.version', $dataset->active_version_id)->json();

            self::assertSame($global, $scoped, $path);
        }
    }

    public function test_scoped_lookups_do_not_fall_back_to_another_active_dataset(): void
    {
        $dataset = \App\Models\Dataset::query()->create([
            'slug' => 'no-active-version',
            'name' => 'No active version',
            'timezone' => 'Asia/Ho_Chi_Minh',
        ]);

        foreach ($this->scopedLookupPaths() as $path) {
            $this->getJson('/api/v1/gtfs' . $path)->assertOk();
            $this->getJson("/api/v1/datasets/{$dataset->id}" . $path)
                ->assertNotFound()->assertJsonPath('errors.0.code', 'NO_ACTIVE_VERSION');
        }
    }

    /** @return list<string> */
    private function scopedLookupPaths(): array
    {
        return [
            '/stops',
            '/stops/nearby?lat=21.0285&lon=105.8242&radius=1000',
            '/stops/KM001',
            '/stops/KM001/departures?date=2026-10-22&time=01:00:00',
            '/routes',
            '/routes/01',
            '/routes/01/trips?date=2026-10-22',
            '/trips?date=2026-10-22',
            '/trips/TRIP_07_NIGHT',
            '/trips/TRIP_07_NIGHT/stop-times',
        ];
    }
}
