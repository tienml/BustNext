<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Dataset;
use Tests\TestCase;

final class GtfsAgencyAndWarningTest extends TestCase
{
    private Dataset $dataset;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
        $this->actingAsAdmin();
        $this->dataset = Dataset::query()->where('slug', 'hanoi-bus')->firstOrFail();
    }

    public function test_unknown_agency_reference_is_a_validation_error_even_with_one_agency(): void
    {
        $routes = "route_id,agency_id,route_short_name,route_type\n";
        for ($i = 1; $i <= 5; $i++) {
            $routes .= "R{$i},missing,{$i},3\n";
        }
        $response = $this->upload(['routes.txt' => $routes])
            ->assertStatus(422)->assertJsonPath('status', 'failed');
        self::assertContains('unknown_agency', array_column($response->json('errors'), 'code'));
    }

    public function test_single_agency_can_omit_agency_ids_and_routes_resolve_to_it(): void
    {
        $response = $this->upload([
            'agency.txt' => "agency_name,agency_url,agency_timezone\nSolo,https://example.test,Asia/Ho_Chi_Minh\n",
            'routes.txt' => $this->routesWithoutAgency(),
        ])->assertCreated()->assertJsonPath('status', 'ready');
        $id = (int) $response->json('version.id');
        $this->postJson("/api/v1/versions/{$id}/activate")->assertOk();
        $this->getJson("/api/v1/datasets/{$this->dataset->id}/routes")
            ->assertOk()->assertJsonPath('meta.count', 5)->assertJsonPath('data.0.agency_name', 'Solo');
    }

    public function test_multiple_agencies_require_route_agency_ids(): void
    {
        $response = $this->upload([
            'agency.txt' => "agency_id,agency_name,agency_url,agency_timezone\na,One,https://example.test,Asia/Ho_Chi_Minh\nb,Two,https://example.test,Asia/Ho_Chi_Minh\n",
            'routes.txt' => $this->routesWithoutAgency(),
        ])->assertStatus(422)->assertJsonPath('status', 'failed');
        self::assertNotEmpty(array_filter($response->json('errors'), static fn (array $error): bool =>
            $error['file_name'] === 'routes.txt' && $error['column_name'] === 'agency_id'));
    }

    public function test_multiple_agencies_require_ids_in_agency_file(): void
    {
        $response = $this->upload([
            'agency.txt' => "agency_name,agency_url,agency_timezone\nOne,https://example.test,Asia/Ho_Chi_Minh\nTwo,https://example.test,Asia/Ho_Chi_Minh\n",
            'routes.txt' => $this->routesWithoutAgency(),
        ])->assertStatus(422)->assertJsonPath('status', 'failed');
        self::assertNotEmpty(array_filter($response->json('errors'), static fn (array $error): bool =>
            $error['file_name'] === 'agency.txt' && $error['column_name'] === 'agency_id'));
    }

    public function test_duplicate_agency_ids_are_rejected_before_persistence(): void
    {
        $response = $this->upload([
            'agency.txt' => "agency_id,agency_name,agency_url,agency_timezone\nbn,One,https://example.test,Asia/Ho_Chi_Minh\nbn,Two,https://example.test,Asia/Ho_Chi_Minh\n",
        ])->assertStatus(422)->assertJsonPath('status', 'failed');
        self::assertNotEmpty(array_filter($response->json('errors'), static fn (array $error): bool =>
            $error['file_name'] === 'agency.txt' && $error['column_name'] === 'agency_id'));
        self::assertNotContains('import_failed', array_column($response->json('errors'), 'code'));
    }

    public function test_single_named_agency_can_supply_the_default_for_routes_without_ids(): void
    {
        $response = $this->upload(['routes.txt' => $this->routesWithoutAgency()])
            ->assertCreated()->assertJsonPath('status', 'ready');
        $id = (int) $response->json('version.id');
        $this->postJson("/api/v1/versions/{$id}/activate")->assertOk();
        $this->getJson("/api/v1/datasets/{$this->dataset->id}/routes?agency_id=bn")
            ->assertOk()->assertJsonPath('meta.count', 5);
    }

    public function test_ready_import_warnings_are_returned_and_persisted_for_validation_review(): void
    {
        $response = $this->upload([
            'shapes.txt' => "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\ns,10,106,1\n",
        ])->assertCreated()->assertJsonPath('status', 'ready')
            ->assertJsonPath('version.error_count', 0)->assertJsonPath('version.warning_count', 1)
            ->assertJsonPath('warnings.0.code', 'unsupported_file');
        $id = (int) $response->json('version.id');
        $this->getJson("/api/v1/versions/{$id}/validation")->assertOk()
            ->assertJsonPath('data.data.0.code', 'unsupported_file')
            ->assertJsonPath('data.data.0.severity', 'warning');
    }

    private function upload(array $overrides): \Illuminate\Testing\TestResponse
    {
        return $this->post("/api/v1/datasets/{$this->dataset->id}/versions", [
            'file' => $this->gtfsFixtureZip('dataset-a-v1', $overrides),
        ]);
    }

    private function routesWithoutAgency(): string
    {
        $csv = "route_id,route_short_name,route_type\n";
        for ($i = 1; $i <= 5; $i++) {
            $csv .= "R{$i},{$i},3\n";
        }
        return $csv;
    }
}
