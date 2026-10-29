<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Dataset;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Passenger accounts and admin accounts see different parts of the API. */
final class AdminAccessTest extends TestCase
{
    private Dataset $dataset;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
        User::query()->whereIn('email', ['rider@test.local', 'new@test.local'])->delete();
        $this->dataset = Dataset::query()->where('slug', 'hanoi-bus')->firstOrFail();
    }

    public function test_guests_cannot_reach_admin_endpoints(): void
    {
        $this->getJson("/api/v1/datasets/{$this->dataset->id}/versions")->assertUnauthorized();
        $this->getJson("/api/v1/datasets/{$this->dataset->id}/queries")->assertUnauthorized();
    }

    public function test_regular_users_are_forbidden_from_admin_endpoints(): void
    {
        $rider = User::query()->create(['name' => 'Rider', 'email' => 'rider@test.local', 'password' => 'password-123']);
        Sanctum::actingAs($rider);
        $versionId = $this->dataset->active_version_id;

        $this->getJson("/api/v1/datasets/{$this->dataset->id}/versions")->assertForbidden()->assertJsonPath('errors.0.code', 'FORBIDDEN');
        $this->postJson("/api/v1/versions/{$versionId}/activate")->assertForbidden();
        $this->postJson("/api/v1/versions/{$versionId}/export/schedule/link")->assertForbidden();
        $this->postJson("/api/v1/datasets/{$this->dataset->id}/queries", ['name' => 'x', 'type' => 'stops', 'params' => ['q' => 'x']])->assertForbidden();

        // Passenger features keep working for the same account.
        $this->getJson('/api/v1/gtfs/stops')->assertOk();
        $this->getJson('/api/v1/favorites')->assertOk();
    }

    public function test_admins_can_reach_admin_endpoints(): void
    {
        $this->actingAsAdmin();

        $this->getJson("/api/v1/datasets/{$this->dataset->id}/versions")->assertOk();
        $this->getJson("/api/v1/datasets/{$this->dataset->id}/queries")->assertOk();
    }

    public function test_registration_always_creates_a_regular_user(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Người mới',
            'email' => 'new@test.local',
            'password' => 'password-123',
            'password_confirmation' => 'password-123',
            'role' => 'admin',
        ])->assertCreated();

        $response->assertJsonPath('data.user.role', 'user');
        self::assertSame('user', User::query()->where('email', 'new@test.local')->value('role'));
    }

    public function test_me_reports_the_role(): void
    {
        $this->actingAsAdmin();
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.role', 'admin');
    }

    public function test_admin_command_promotes_and_revokes(): void
    {
        User::query()->create(['name' => 'Rider', 'email' => 'rider@test.local', 'password' => 'password-123']);

        $this->artisan('user:admin', ['email' => 'rider@test.local'])->assertSuccessful();
        self::assertSame('admin', User::query()->where('email', 'rider@test.local')->value('role'));

        $this->artisan('user:admin', ['email' => 'rider@test.local', '--revoke' => true])->assertSuccessful();
        self::assertSame('user', User::query()->where('email', 'rider@test.local')->value('role'));
    }
}
