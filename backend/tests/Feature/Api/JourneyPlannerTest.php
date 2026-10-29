<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use Tests\TestCase;

final class JourneyPlannerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
    }

    public function test_it_plans_a_direct_journey_from_static_gtfs(): void
    {
        $response = $this->getJson('/api/v1/journeys/plan?from_stop_id=YN001&to_stop_id=GL001&date=2026-10-22&time=05:30:00');

        $response->assertOk()
            ->assertJsonPath('meta.count', 2)
            ->assertJsonPath('data.0.type', 'direct')
            ->assertJsonPath('data.0.transfers', 0)
            ->assertJsonPath('data.0.legs.0.trip_id', 'TRIP_01_001')
            ->assertJsonPath('data.0.departure_time', '06:00:00')
            ->assertJsonPath('data.0.arrival_time', '07:20:00');
    }

    public function test_it_plans_one_transfer_when_no_direct_trip_exists(): void
    {
        $response = $this->getJson('/api/v1/journeys/plan?from_stop_id=YN001&to_stop_id=NN001&date=2026-10-22&time=05:30:00&max_transfers=1');

        $response->assertOk()
            ->assertJsonPath('meta.count', 1)
            ->assertJsonPath('data.0.type', 'one_transfer')
            ->assertJsonPath('data.0.transfers', 1)
            ->assertJsonPath('data.0.legs.0.trip_id', 'TRIP_01_001')
            ->assertJsonPath('data.0.legs.1.trip_id', 'TRIP_07_001')
            ->assertJsonPath('data.0.legs.0.to.stop_id', 'KM001')
            ->assertJsonPath('data.0.legs.1.from.stop_id', 'KM001');
    }

    public function test_it_includes_a_previous_service_date_after_midnight(): void
    {
        $response = $this->getJson('/api/v1/journeys/plan?from_stop_id=KM001&to_stop_id=NN001&date=2026-10-22&time=01:00:00&max_transfers=0&limit=1');

        $response->assertOk()
            ->assertJsonPath('meta.count', 1)
            ->assertJsonPath('data.0.legs.0.trip_id', 'TRIP_07_NIGHT')
            ->assertJsonPath('data.0.service_date', '2026-10-21')
            ->assertJsonPath('data.0.departure_time', '25:10:00')
            ->assertJsonPath('data.0.arrival_time', '25:45:00')
            ->assertJsonPath('data.0.legs.0.service_date', '2026-10-21');
    }

    public function test_it_returns_empty_data_when_no_journey_is_available(): void
    {
        $response = $this->getJson('/api/v1/journeys/plan?from_stop_id=GL001&to_stop_id=YN001&date=2026-10-22&time=05:30:00');

        $response->assertOk()->assertJsonPath('meta.count', 0);
        self::assertSame([], $response->json('data'));
    }

    public function test_it_rejects_unknown_stops(): void
    {
        $this->getJson('/api/v1/journeys/plan?from_stop_id=NOPE&to_stop_id=GL001&date=2026-10-22&time=05:30:00')
            ->assertNotFound()
            ->assertJsonPath('errors.0.code', 'STOP_NOT_FOUND');
    }
}
