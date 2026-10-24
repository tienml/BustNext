<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use Illuminate\Support\Facades\Date;
use Tests\TestCase;

final class StopLookupTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
    }

    public function test_it_lists_stops_of_the_active_version(): void
    {
        $response = $this->getJson('/api/v1/gtfs/stops');

        $response->assertOk()
            ->assertJsonPath('meta.count', 6)
            ->assertJsonStructure(['data' => [['stop_id', 'code', 'name', 'lat', 'lon']]]);
    }

    public function test_it_filters_stops_by_name(): void
    {
        $response = $this->getJson('/api/v1/gtfs/stops?q=Kim');

        $response->assertOk()
            ->assertJsonPath('meta.count', 1)
            ->assertJsonPath('data.0.stop_id', 'KM001');
    }

    public function test_it_returns_stop_detail_and_404_for_unknown_stop(): void
    {
        $this->getJson('/api/v1/gtfs/stops/KM001')
            ->assertOk()
            ->assertJsonPath('data.name', 'Kim Mã');

        $this->getJson('/api/v1/gtfs/stops/NOPE')
            ->assertNotFound()
            ->assertJsonPath('errors.0.code', 'STOP_NOT_FOUND');
    }

    public function test_it_lists_nearby_stops_sorted_by_distance(): void
    {
        // Standing at Kim Mã: that stop must come first, Đại học Thăng Long is
        // several kilometres away and must be filtered out by the radius.
        $response = $this->getJson('/api/v1/gtfs/stops/nearby?lat=21.0285&lon=105.8242&radius=1000');

        $response->assertOk();
        $stops = $response->json('data');

        self::assertSame('KM001', $stops[0]['stop_id']);
        self::assertLessThan(50, (float) $stops[0]['distance_meters']);
        foreach ($stops as $stop) {
            self::assertLessThanOrEqual(1000, (float) $stop['distance_meters']);
        }
    }

    public function test_nearby_validates_coordinates(): void
    {
        $this->getJson('/api/v1/gtfs/stops/nearby?lat=999&lon=105')
            ->assertStatus(422);
    }

    /**
     * At 01:00 on 22/10 the 25:10 trip that started on the 21st is ten minutes
     * away. Its service date must still be reported as the 21st.
     */
    public function test_departures_include_after_midnight_trip_from_previous_service_date(): void
    {
        Date::setTestNow('2026-10-22 01:00:00');

        $response = $this->getJson('/api/v1/gtfs/stops/KM001/departures?date=2026-10-22&time=01:00:00');

        $response->assertOk();
        $data = $response->json('data');

        $night = collect($data)->firstWhere('trip_id', 'TRIP_07_NIGHT');
        self::assertNotNull($night, 'Expected the 25:10 trip to be listed');
        self::assertSame('2026-10-21', $night['service_date']);
        self::assertSame('25:10:00', $night['departure_time']);
        self::assertSame(10, $night['minutes_until']);
    }

    public function test_departures_respect_calendar_exception_removing_service(): void
    {
        // 02/09/2026 is a Wednesday, but WEEKDAY is removed by an exception.
        Date::setTestNow('2026-09-02 05:00:00');

        $response = $this->getJson('/api/v1/gtfs/stops/YN001/departures?date=2026-09-02&time=05:00:00');

        $response->assertOk()->assertJsonPath('meta.count', 0);
    }
}
