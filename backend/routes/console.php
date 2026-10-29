<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Validator;

/*
 * Create an admin account, or promote/demote an existing one.
 *   php artisan user:admin admin@busnext.local --name="Quản trị"
 *   php artisan user:admin someone@example.com --revoke
 */
Artisan::command('user:admin {email} {--name=} {--password=} {--revoke}', function (string $email): int {
    $user = User::query()->where('email', $email)->first();

    if ($this->option('revoke')) {
        if ($user === null) {
            $this->error("No account with email {$email}.");
            return 1;
        }
        $user->forceFill(['role' => User::ROLE_USER])->save();
        $user->tokens()->delete();
        $this->info("{$email} is now a regular user. Existing tokens were revoked.");
        return 0;
    }

    if ($user === null) {
        $password = (string) ($this->option('password') ?? $this->secret('Password (min 8 characters)'));
        $validator = Validator::make(
            ['email' => $email, 'password' => $password],
            ['email' => ['required', 'email', 'max:255'], 'password' => ['required', 'string', 'min:8']],
        );
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }
            return 1;
        }
        $user = User::query()->create([
            'name' => (string) ($this->option('name') ?: 'Quản trị viên'),
            'email' => $email,
            'password' => $password,
        ]);
    }

    $user->forceFill(['role' => User::ROLE_ADMIN])->save();
    $this->info("{$email} is an admin.");
    return 0;
})->purpose('Create or promote an admin account');
