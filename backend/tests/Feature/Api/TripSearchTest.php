<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Dataset;
use Tests\TestCase;

final class TripSearchTest extends TestCase
{
    private Dataset $dataset;
    private int $versionId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
        $this->actingAsAdmin();
        $this->dataset = Dataset::query()->where('slug', 'hanoi-bus')->firstOrFail();
        $trips = file_get_contents(dirname(__DIR__, 4) . '/fixtures/gtfs/dataset-a-v1/trips.txt');
        self::assertIsString($trips);
        $trips = str_replace('T001,Tram 2,0', 'T001,Tram 2,1', $trips);
        $routes = "route_id,agency_id,route_short_name,route_long_name,route_type\n"
            . "R1,bn,1,Tuyen 1,2\nR2,bn,2,Tuyen 2,3\nR3,bn,3,Tuyen 3,3\n"
            . "R4,bn,4,Tuyen 4,3\nR5,bn,5,Tuyen 5,3\n";
        $response = $this->post("/api/v1/datasets/{$this->dataset->id}/versions", [
            'file' => $this->gtfsFixtureZip('dataset-a-v1', ['trips.txt' => $trips, 'routes.txt' => $routes]),
        ])->assertCreated()->assertJsonPath('status', 'ready');
        $this->versionId = (int) $response->json('version.id');
        $this->postJson("/api/v1/versions/{$this->versionId}/activate")->assertOk();
    }

    public function test_trip_search_combines_text_route_type_direction_and_date_filters(): void
    {
        $base = "/api/v1/datasets/{$this->dataset->id}/trips";
        $this->getJson($base . '?q=Tram%202&route_id=R1&route_type=2&direction_id=1&date=2026-10-28')
            ->assertOk()->assertJsonPath('meta.version', $this->versionId)
            ->assertJsonPath('meta.date', '2026-10-28')->assertJsonPath('meta.count', 1)
            ->assertJsonPath('data.0.trip_id', 'T001')->assertJsonPath('data.0.direction_id', 1);
        $this->getJson($base . '?q=T001&route_id=R2')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($base . '?route_id=R1&route_type=3')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($base . '?route_id=R1&direction_id=0')->assertOk()->assertJsonPath('meta.count', 19);
        $this->getJson($base . '?route_id=R1&date=2026-10-25')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($base . '?route_id=R1&date=2026-11-01')->assertOk()->assertJsonPath('meta.count', 20);
        $this->getJson($base . '?route_id=R1&date=2026-10-31')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($base . '?q=T001')->assertOk()->assertJsonPath('data.0.trip_id', 'T001');
        $this->getJson($base . '?q=Tuyen%201&limit=2')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson($base . '?q=does-not-exist')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_global_trip_and_unified_search_include_the_active_trips(): void
    {
        $this->getJson('/api/v1/gtfs/trips?q=T001')->assertOk()
            ->assertJsonPath('meta.version', $this->versionId)->assertJsonPath('data.0.trip_id', 'T001');
        $this->getJson('/api/v1/search?q=T001')->assertOk()
            ->assertJsonPath('meta.version', $this->versionId)
            ->assertJsonPath('meta.counts.trips', 1)->assertJsonPath('data.trips.0.trip_id', 'T001');
        // The seeded, now archived snapshot must not leak through text OR clauses.
        $this->getJson('/api/v1/gtfs/trips?q=TRIP_')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_route_trip_filters_apply_before_the_result_limit(): void
    {
        $base = "/api/v1/datasets/{$this->dataset->id}/routes/R1/trips";
        $this->getJson($base . '?date=2026-10-28&q=T001&direction_id=1&limit=1')
            ->assertOk()->assertJsonPath('meta.count', 1)->assertJsonPath('data.0.trip_id', 'T001');
        $this->getJson($base . '?date=2026-10-28&q=T001&direction_id=0')
            ->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($base . '?date=2026-10-28&q=Tram%202&direction_id=0&limit=2')
            ->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_search_filter_inputs_are_validated(): void
    {
        $base = "/api/v1/datasets/{$this->dataset->id}/trips";
        foreach (['direction_id=2' => 'direction_id', 'route_type=99' => 'route_type',
            'date=not-a-date' => 'date', 'limit=0' => 'limit', 'limit=201' => 'limit',
            'q[]=x' => 'q'] as $query => $field) {
            $this->getJson($base . '?' . $query)->assertStatus(422)->assertJsonValidationErrors([$field]);
        }
    }

    public function test_route_and_stop_filters_are_intersections_not_alternatives(): void
    {
        $base = "/api/v1/datasets/{$this->dataset->id}";
        $this->getJson($base . '/routes?agency_id=bn&route_type=2')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.route_id', 'R1');
        $this->getJson($base . '/routes?agency_id=unknown')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($base . '/stops?route_id=R1&route_type=3&limit=100')
            ->assertOk()->assertJsonCount(0, 'data');
        $stops = $this->getJson($base . '/stops?route_id=R1&route_type=2&limit=100')
            ->assertOk()->json('data');
        self::assertNotEmpty($stops);
        $routeStops = $this->getJson($base . '/routes/R1')->assertOk()->json('stops');
        self::assertEqualsCanonicalizing(array_column($routeStops, 'stop_id'), array_column($stops, 'stop_id'));
    }
}
