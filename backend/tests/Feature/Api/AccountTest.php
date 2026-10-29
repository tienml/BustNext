<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSampleDataset();
        $this->withMiddleware();
    }

    public function test_it_registers_a_user_and_returns_a_token(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Nguyen Van A',
            'email' => 'a@example.test',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user.email', 'a@example.test')
            ->assertJsonPath('data.user.name', 'Nguyen Van A')
            ->assertJsonStructure(['data' => ['user', 'token']]);

        self::assertDatabaseHas('users', ['email' => 'a@example.test']);
    }

    public function test_it_rejects_invalid_login_credentials(): void
    {
        $user = User::query()->create([
            'name' => 'Nguyen Van A',
            'email' => 'a@example.test',
            'password' => 'password123',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertUnauthorized()
            ->assertJsonPath('errors.0.code', 'INVALID_CREDENTIALS');
    }

    public function test_it_returns_the_authenticated_profile_and_revokes_the_current_token_on_logout(): void
    {
        $user = User::query()->create([
            'name' => 'Nguyen Van A',
            'email' => 'a@example.test',
            'password' => 'password123',
        ]);
        $token = $user->createToken('busnext-mobile')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.email', 'a@example.test');

        $this->withToken($token)->postJson('/api/v1/auth/logout')
            ->assertOk()
            ->assertJsonPath('data.logged_out', true);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_favorites_are_owned_by_the_authenticated_user_and_are_idempotent(): void
    {
        $user = User::query()->create([
            'name' => 'Nguyen Van A',
            'email' => 'a@example.test',
            'password' => 'password123',
        ]);
        $otherUser = User::query()->create([
            'name' => 'Tran Van B',
            'email' => 'b@example.test',
            'password' => 'password123',
        ]);
        $token = $user->createToken('busnext-mobile')->plainTextToken;
        $otherToken = $otherUser->createToken('busnext-mobile')->plainTextToken;

        $first = $this->withToken($token)->postJson('/api/v1/favorites', ['type' => 'stop', 'entity_id' => 'KM001']);
        $first->assertCreated();
        $favoriteId = $first->json('data.id');

        $this->withToken($token)->postJson('/api/v1/favorites', ['type' => 'stop', 'entity_id' => 'KM001'])
            ->assertOk()
            ->assertJsonPath('data.id', $favoriteId);

        $this->withToken($token)->getJson('/api/v1/favorites')
            ->assertOk()
            ->assertJsonPath('meta.count', 1)
            ->assertJsonPath('data.0.entity.stop_id', 'KM001')
            ->assertJsonPath('data.0.entity.name', 'Kim Mã');

        $this->withToken($token)->postJson('/api/v1/favorites', ['type' => 'stop', 'entity_id' => 'UNKNOWN'])
            ->assertNotFound()
            ->assertJsonPath('errors.0.code', 'ENTITY_NOT_FOUND');

        $this->app['auth']->forgetGuards();
        $this->withToken($otherToken)->deleteJson('/api/v1/favorites/' . $favoriteId)->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->deleteJson('/api/v1/favorites/' . $favoriteId)
            ->assertOk()
            ->assertJsonPath('data.deleted', true);
    }
}
