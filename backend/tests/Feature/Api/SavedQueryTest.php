<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Dataset;
use Tests\TestCase;

/**
 * Scenario 2 of the brief: import a new version, compare, switch, and re-run
 * the saved sample queries against the newly active version.
 */
final class SavedQueryTest extends TestCase
{
    private Dataset $dataset;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
        $this->actingAsAdmin();
        $this->dataset = Dataset::query()->where('slug', 'hanoi-bus')->firstOrFail();
    }

    public function test_saved_query_is_rerun_against_the_newly_activated_version(): void
    {
        $v1 = $this->import('dataset-a-v1');
        $this->postJson("/api/v1/versions/{$v1}/activate")->assertOk();

        $queryId = $this->postJson("/api/v1/datasets/{$this->dataset->id}/queries", [
            'name' => 'Chuyến kế tiếp tại S20 lúc 08:50',
            'type' => 'departures',
            'params' => ['stop_id' => 'S20', 'date' => '2026-10-28', 'time' => '08:50:00', 'limit' => 1],
        ])->assertCreated()->json('data.id');

        $this->postJson("/api/v1/queries/{$queryId}/run")
            ->assertOk()
            ->assertJsonPath('data.ok', true)
            ->assertJsonPath('data.version', $v1)
            ->assertJsonPath('data.data.0.trip_id', 'T100');

        // v2 removes T100 and adds T101 at 09:31 on the same stop.
        $v2 = $this->import('dataset-a-v2');
        $this->postJson("/api/v1/versions/{$v2}/activate")->assertOk();

        $this->postJson("/api/v1/datasets/{$this->dataset->id}/queries/run")
            ->assertOk()
            ->assertJsonPath('meta.count', 1)
            ->assertJsonPath('meta.failed', 0)
            ->assertJsonPath('data.0.version', $v2)
            ->assertJsonPath('data.0.data.0.trip_id', 'T101')
            ->assertJsonPath('data.0.data.0.departure_time', '09:31:00');

        $this->getJson("/api/v1/datasets/{$this->dataset->id}/queries")
            ->assertOk()
            ->assertJsonPath('data.0.last_version_id', $v2)
            ->assertJsonPath('data.0.last_status', 200)
            ->assertJsonPath('data.0.last_result_count', 1);
    }

    public function test_a_query_whose_entity_disappeared_reports_not_found(): void
    {
        $v1 = $this->import('dataset-a-v1');
        $this->postJson("/api/v1/versions/{$v1}/activate")->assertOk();

        $queryId = $this->postJson("/api/v1/datasets/{$this->dataset->id}/queries", [
            'name' => 'Lộ trình T100',
            'type' => 'trip',
            'params' => ['trip_id' => 'T100'],
        ])->assertCreated()->json('data.id');

        $this->postJson("/api/v1/queries/{$queryId}/run")->assertJsonPath('data.ok', true)->assertJsonPath('data.count', 3);

        $v2 = $this->import('dataset-a-v2');
        $this->postJson("/api/v1/versions/{$v2}/activate")->assertOk();

        $this->postJson("/api/v1/queries/{$queryId}/run")
            ->assertOk()
            ->assertJsonPath('data.ok', false)
            ->assertJsonPath('data.status', 404)
            ->assertJsonPath('data.errors.0.code', 'TRIP_NOT_FOUND');
    }

    public function test_store_requires_the_params_of_the_query_type(): void
    {
        $this->postJson("/api/v1/datasets/{$this->dataset->id}/queries", [
            'name' => 'Thiếu trạm',
            'type' => 'departures',
            'params' => ['time' => '08:00:00'],
        ])->assertStatus(422)->assertJsonValidationErrors(['params.stop_id']);

        $this->postJson("/api/v1/datasets/{$this->dataset->id}/queries", [
            'name' => 'Sai loại',
            'type' => 'drop_table',
            'params' => ['q' => 'x'],
        ])->assertStatus(422)->assertJsonValidationErrors(['type']);
    }

    public function test_update_and_delete(): void
    {
        $id = $this->postJson("/api/v1/datasets/{$this->dataset->id}/queries", [
            'name' => 'Tìm Kim Mã',
            'type' => 'stops',
            'params' => ['q' => 'Kim', 'ignored' => 'dropped'],
        ])->assertCreated()->assertJsonMissingPath('data.params.ignored')->json('data.id');

        $this->putJson("/api/v1/queries/{$id}", ['name' => 'Tìm tuyến 01', 'type' => 'routes', 'params' => ['q' => '01']])
            ->assertOk()
            ->assertJsonPath('data.type', 'routes');

        $this->deleteJson("/api/v1/queries/{$id}")->assertNoContent();
        $this->getJson("/api/v1/datasets/{$this->dataset->id}/queries")->assertJsonCount(0, 'data');
    }

    private function import(string $fixture): int
    {
        $response = $this->post("/api/v1/datasets/{$this->dataset->id}/versions", [
            'file' => $this->gtfsFixtureZip($fixture),
            'label' => $fixture,
        ]);
        $response->assertCreated()->assertJsonPath('status', 'ready');

        return (int) $response->json('version.id');
    }
}
