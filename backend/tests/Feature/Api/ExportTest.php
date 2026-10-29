<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Dataset;
use Tests\TestCase;

final class ExportTest extends TestCase
{
    private Dataset $dataset;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
        $this->actingAsAdmin();
        $this->dataset = Dataset::query()->where('slug', 'hanoi-bus')->firstOrFail();
    }

    public function test_schedule_export_lists_stop_times_with_raw_gtfs_times(): void
    {
        $version = $this->upload('dataset-a-v1')->json('version');

        $response = $this->get($this->exportLink($version['id'], 'schedule'));
        $response->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        self::assertStringContainsString("schedule-v{$version['version_number']}.csv", (string) $response->headers->get('Content-Disposition'));

        $rows = $this->rows($response->streamedContent());
        self::assertSame(
            ['route_id', 'route_short_name', 'trip_id', 'service_id', 'trip_headsign', 'direction_id', 'stop_sequence', 'stop_id', 'stop_name', 'arrival_time', 'departure_time'],
            $rows[0],
        );
        // One CSV row per stop_times.txt row (both files carry a header line).
        $fixtureLines = file(dirname(__DIR__, 4) . '/fixtures/gtfs/dataset-a-v1/stop_times.txt', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        self::assertCount(count($fixtureLines), $rows);
        self::assertContains('25:10:00', array_column($rows, 9), 'After-midnight times stay in raw GTFS form.');
    }

    public function test_schedule_export_can_be_limited_to_one_route(): void
    {
        $versionId = $this->upload('dataset-a-v2')->json('version.id');

        $rows = $this->rows($this->get($this->exportLink($versionId, 'schedule', 'R4'))->streamedContent());

        $routeIds = array_unique(array_column(array_slice($rows, 1), 0));
        self::assertSame(['R4'], array_values($routeIds));
        self::assertContains('T102', array_column($rows, 2));
    }

    public function test_validation_export_lists_errors_of_a_failed_import(): void
    {
        $upload = $this->upload('invalid-references');
        $upload->assertStatus(422)->assertJsonPath('status', 'failed');
        $versionId = $upload->json('version.id');

        $rows = $this->rows($this->get($this->exportLink($versionId, 'validation'))->assertOk()->streamedContent());

        self::assertSame(['severity', 'code', 'file_name', 'row_number', 'column_name', 'value', 'message'], $rows[0]);
        self::assertGreaterThan(1, count($rows));
        self::assertContains('stop_times.txt', array_column($rows, 2));
    }

    public function test_export_needs_a_valid_signature(): void
    {
        $versionId = $this->upload('dataset-a-v1')->json('version.id');

        $this->get("/api/v1/versions/{$versionId}/export/schedule.csv")->assertForbidden();
        $this->get($this->exportLink($versionId, 'schedule') . 'x')->assertForbidden();
    }

    /** Ask the API for a signed download path, as the admin screen does. */
    private function exportLink(int $versionId, string $kind, ?string $routeId = null): string
    {
        $query = $routeId ? '?route_id=' . rawurlencode($routeId) : '';

        return $this->postJson("/api/v1/versions/{$versionId}/export/{$kind}/link{$query}")
            ->assertOk()
            ->json('data.path');
    }

    private function upload(string $fixture): \Illuminate\Testing\TestResponse
    {
        return $this->post("/api/v1/datasets/{$this->dataset->id}/versions", [
            'file' => $this->gtfsFixtureZip($fixture),
            'label' => $fixture,
        ]);
    }

    /** @return list<list<string>> */
    private function rows(string $csv): array
    {
        self::assertStringStartsWith("\xEF\xBB\xBF", $csv, 'CSV starts with a UTF-8 BOM for Excel.');
        $lines = preg_split('/\r?\n/', trim(substr($csv, 3))) ?: [];

        return array_map(static fn (string $line): array => str_getcsv($line, escape: ''), $lines);
    }
}
