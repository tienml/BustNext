<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Notifications\PasswordResetOtpNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

final class PasswordResetOtpService
{
    public const EXPIRES_SECONDS = 300;
    public const RESEND_SECONDS = 60;
    public const MAX_ATTEMPTS = 5;

    public function send(string $email): void
    {
        // The user row is the stable mutex, even before an OTP row exists.
        // Every issue/verify/cleanup path locks in this same order.
        $delivery = DB::transaction(function () use ($email): ?array {
            $user = User::query()->where('email', $email)->lockForUpdate()->first();
            if ($user === null) {
                return null;
            }
            $record = DB::table('password_reset_otps')->where('user_id', $user->id)->lockForUpdate()->first();
            $now = CarbonImmutable::now();
            if ($record !== null && CarbonImmutable::parse($record->sent_at)->addSeconds(self::RESEND_SECONDS)->isAfter($now)) {
                return null;
            }

            do {
                $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            } while ($record?->code_hash !== null && Hash::check($code, $record->code_hash));
            $hash = Hash::make($code);
            DB::table('password_reset_otps')->updateOrInsert(['user_id' => $user->id], [
                'email' => $user->email,
                'code_hash' => $hash,
                'attempts' => 0,
                'expires_at' => $now->addSeconds(self::EXPIRES_SECONDS),
                'sent_at' => $now,
            ]);

            return [$user, $code, $hash];
        }, 3);

        if ($delivery === null) {
            return;
        }
        [$user, $code, $hash] = $delivery;
        try {
            // Synchronous SMTP only: never fall back to the log mailer.
            $user->notify(new PasswordResetOtpNotification($code));
        } catch (Throwable) {
            DB::transaction(function () use ($user, $hash): void {
                User::query()->whereKey($user->id)->lockForUpdate()->first();
                DB::table('password_reset_otps')->where('user_id', $user->id)
                    ->where('code_hash', $hash)->update(['code_hash' => null]);
            }, 3);
            // Do not report the exception: transport diagnostics may include secrets.
            Log::warning('Password recovery email delivery failed. Retry is available after the resend cooldown.');
        }
    }

    public function reset(string $email, string $code, string $password): bool
    {
        return DB::transaction(function () use ($email, $code, $password): bool {
            $user = User::query()->where('email', $email)->lockForUpdate()->first();
            if ($user === null) {
                return false;
            }
            $query = DB::table('password_reset_otps')->where('user_id', $user->id);
            $record = (clone $query)->lockForUpdate()->first();
            if ($record === null || $record->email !== $user->email || $record->code_hash === null
                || $record->attempts >= self::MAX_ATTEMPTS
                || CarbonImmutable::parse($record->expires_at)->lessThanOrEqualTo(CarbonImmutable::now())) {
                return false;
            }
            if (!Hash::check($code, $record->code_hash)) {
                $attempts = $record->attempts + 1;
                $query->update([
                    'attempts' => $attempts,
                    'code_hash' => $attempts >= self::MAX_ATTEMPTS ? null : $record->code_hash,
                ]);
                // Return rather than throw so the failed attempt is committed.
                return false;
            }

            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
            $user->tokens()->delete();
            // Also revoke any previously issued legacy broker token, without changing its format.
            DB::table(config('auth.passwords.users.table', 'password_reset_tokens'))->where('email', $user->email)->delete();
            $query->update(['code_hash' => null]);

            return true;
        }, 3);
    }
}
