<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\User;
use App\Notifications\PasswordResetOtpNotification;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

/** Standalone in-memory suite: no project .env, GTFS seed, or RefreshDatabase. */
final class PasswordResetOtpTest extends TestCase
{
    public function createApplication(): Application
    {
        foreach (['APP_ENV' => 'testing', 'DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => ':memory:',
            'APP_CONFIG_CACHE' => __DIR__ . '/__no_otp_config_cache__.php',
            'APP_KEY' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array'] as $key => $value) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $_SERVER[$key] = $value;
        }
        $app = require dirname(__DIR__, 3) . '/bootstrap/app.php';
        $app->useEnvironmentPath(__DIR__);
        $app->loadEnvironmentFrom('__no_otp_test_env__');
        $app->make(Kernel::class)->bootstrap();
        $app['config']->set('database.connections.sqlite', [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]);
        $app['config']->set('cache.default', 'array');
        $app['config']->set('cache.stores.array', ['driver' => 'array', 'serialize' => false]);
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:') {
            throw new \RuntimeException('Refusing to run OTP tests outside SQLite memory.');
        }
        return $app;
    }

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        foreach (['2026_10_28_000002_create_users_tokens_favorites.php',
            '2026_10_29_000005_add_role_to_users.php',
            '2026_11_10_000006_create_password_reset_tokens.php',
            '2026_11_12_000007_create_password_reset_otps.php'] as $migration) {
            (require database_path('migrations/' . $migration))->up();
        }
    }

    private function user(string $email = 'otp@example.test'): User
    {
        return User::query()->create(['name' => 'OTP Test', 'email' => $email, 'password' => 'old-password']);
    }

    private function issue(User $user): string
    {
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertOk()
            ->assertJsonPath('data.expires_in', 300)->assertJsonPath('data.resend_after', 60);
        $notification = Notification::sent($user, PasswordResetOtpNotification::class)->last();
        self::assertNotNull($notification);
        $lines = implode('\n', $notification->toMail($user)->introLines);
        self::assertSame(1, preg_match('/(?<![0-9])[0-9]{6}(?![0-9])/', $lines, $matches));
        return $matches[0];
    }

    private function reset(User $user, mixed $code, string $password = 'new-password')
    {
        return $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email, 'token' => $code,
            'password' => $password, 'password_confirmation' => $password,
        ]);
    }

    public function test_generic_response_and_hashed_email_bound_one_time_code(): void
    {
        $user = $this->user();
        $user->createToken('mobile');
        $code = $this->issue($user);
        $record = DB::table('password_reset_otps')->first();
        self::assertNotSame($code, $record->code_hash);
        self::assertTrue(Hash::check($code, $record->code_hash));
        $missing = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'missing@example.test']);
        $missing->assertOk()->assertJsonPath('data.resend_after', 60);
        self::assertSame(1, DB::table('password_reset_otps')->count());
        Notification::assertCount(1);
        $this->reset($this->user('other@example.test'), $code)->assertUnprocessable();
        $this->reset($user, $code)->assertOk();
        self::assertTrue(Hash::check('new-password', $user->fresh()->password));
        self::assertSame(0, $user->tokens()->count());
        $this->reset($user, $code)->assertUnprocessable();
    }

    public function test_fifth_wrong_attempt_invalidates_code(): void
    {
        $user = $this->user();
        $code = $this->issue($user);
        $wrong = $code === '000000' ? '000001' : '000000';
        for ($i = 0; $i < 5; $i++) {
            $this->reset($user, $wrong)->assertUnprocessable();
        }
        self::assertSame(5, DB::table('password_reset_otps')->value('attempts'));
        $this->reset($user, $code)->assertUnprocessable();
    }

    public function test_expiry_and_resend_cooldown(): void
    {
        $user = $this->user();
        $oldCode = $this->issue($user);
        $hash = DB::table('password_reset_otps')->value('code_hash');
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertOk();
        Notification::assertCount(1);
        self::assertSame($hash, DB::table('password_reset_otps')->value('code_hash'));
        $this->travel(60)->seconds();
        $code = $this->issue($user);
        Notification::assertCount(2);
        self::assertNotSame($oldCode, $code);
        $this->reset($user, $oldCode)->assertUnprocessable();
        self::assertNotSame($hash, DB::table('password_reset_otps')->value('code_hash'));
        $this->travel(300)->seconds();
        $this->reset($user, $code)->assertUnprocessable();
    }

    public function test_validation_and_leading_zero(): void
    {
        $user = $this->user();
        $this->issue($user);
        DB::table('password_reset_otps')->update(['code_hash' => Hash::make('012345')]);
        foreach (['12345', '1234567', 'abcdef', 123456] as $invalid) {
            $this->reset($user, $invalid)->assertUnprocessable();
        }
        $this->reset($user, '012345', 'short')->assertUnprocessable();
        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email, 'token' => '012345',
            'password' => 'new-password', 'password_confirmation' => 'different-password',
        ])->assertUnprocessable();
        $this->reset($user, '012345')->assertOk();
    }

    public function test_delivery_failure_is_generic_and_retry_keeps_cooldown(): void
    {
        $user = $this->user();
        Notification::shouldReceive('send')->once()->andThrow(new \RuntimeException('Transport failure'));
        $existing = $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertOk();
        $missing = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'missing@example.test'])->assertOk();
        self::assertSame($existing->json(), $missing->json());
        self::assertNull(DB::table('password_reset_otps')->value('code_hash'));
        Notification::fake();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertOk();
        Notification::assertNothingSent();
        $this->travel(60)->seconds();
        $this->issue($user);
        Notification::assertCount(1);
    }

    public function test_recovery_routes_are_throttled(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/v1/auth/forgot-password', ['email' => 'missing@example.test'])->assertOk();
        }
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'missing@example.test'])->assertStatus(429);
    }
}
