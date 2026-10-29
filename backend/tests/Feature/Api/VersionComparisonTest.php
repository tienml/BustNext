<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Dataset;
use Tests\TestCase;

/**
 * Required test 5: comparing two versions reports new trips, removed trips
 * and trips whose times were edited.
 *
 * fixtures/gtfs/dataset-a-v2 differs from dataset-a-v1 by:
 *  - T100 removed, T101 and T102 added
 *  - T050 shifted by 5 minutes at all three stops
 *  - route R5 renamed "Tuyến 5 (cập nhật)"
 */
final class VersionComparisonTest extends TestCase
{
    private Dataset $dataset;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
        $this->actingAsAdmin();
        $this->dataset = Dataset::query()->where('slug', 'hanoi-bus')->firstOrFail();
    }

    public function test_compare_reports_added_removed_and_retimed_trips(): void
    {
        [$v1, $v2] = $this->importBoth();

        $response = $this->getJson("/api/v1/versions/compare?base={$v1}&target={$v2}");
        $response->assertOk()
            ->assertJsonPath('data.summary.trips_added', 2)
            ->assertJsonPath('data.summary.trips_removed', 1)
            ->assertJsonPath('data.summary.trips_changed', 1)
            ->assertJsonPath('data.summary.routes_changed', 1);

        self::assertSame(['T101', 'T102'], array_column($response->json('data.trips.added'), 'trip_id'));
        self::assertSame(['T100'], array_column($response->json('data.trips.removed'), 'trip_id'));

        $changed = $response->json('data.trips.changed.0');
        self::assertSame('T050', $changed['trip_id']);
        self::assertCount(3, $changed['stop_times']);
        self::assertSame('time_changed', $changed['stop_times'][0]['type']);
        self::assertSame('07:01:00', $changed['stop_times'][0]['from']['departure_time']);
        self::assertSame('07:06:00', $changed['stop_times'][0]['to']['departure_time']);

        $route = $response->json('data.routes.changed.0');
        self::assertSame('R5', $route['route_id']);
        self::assertSame('long_name', $route['changes'][0]['field']);
        self::assertSame('Tuyến 5 (cập nhật)', $route['changes'][0]['to']);
    }

    public function test_compare_groups_trip_changes_by_route(): void
    {
        [$v1, $v2] = $this->importBoth();

        $groups = collect($this->getJson("/api/v1/versions/compare?base={$v1}&target={$v2}")->json('data.by_route'))
            ->keyBy('route_id');

        self::assertSame(['T101'], $groups['R5']['trips_added']);
        self::assertSame(['T100'], $groups['R5']['trips_removed']);
        self::assertSame(['T050'], $groups['R5']['trips_changed']);
        self::assertSame(['T102'], $groups['R4']['trips_added']);
    }

    public function test_comparing_a_version_with_itself_is_rejected(): void
    {
        [$v1] = $this->importBoth();

        $this->getJson("/api/v1/versions/compare?base={$v1}&target={$v1}")
            ->assertStatus(422)
            ->assertJsonPath('errors.0.code', 'INVALID_COMPARISON');
    }

    /** @return array{0: int, 1: int} */
    private function importBoth(): array
    {
        $ids = [];
        foreach (['dataset-a-v1', 'dataset-a-v2'] as $fixture) {
            $response = $this->post('/api/v1/datasets/' . $this->dataset->id . '/versions', [
                'file' => $this->gtfsFixtureZip($fixture),
                'label' => $fixture,
            ]);
            $response->assertCreated()->assertJsonPath('status', 'ready');
            $ids[] = (int) $response->json('version.id');
        }
        return [$ids[0], $ids[1]];
    }
}
