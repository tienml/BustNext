<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Lets only admin accounts through. Runs after auth:sanctum. */
final class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user instanceof User || !$user->isAdmin()) {
            return response()->json(['errors' => [[
                'code' => 'FORBIDDEN',
                'message' => 'Chỉ tài khoản quản trị mới dùng được chức năng này.',
            ]]], 403);
        }

        return $next($request);
    }
}
