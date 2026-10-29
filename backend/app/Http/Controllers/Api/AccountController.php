<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Favorite;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class AccountController
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::query()->create($validated);
        $token = $user->createToken('busnext-mobile')->plainTextToken;

        return response()->json(['data' => [
            'user' => $user,
            'token' => $token,
        ]], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $validated['email'])->first();
        if ($user === null || !password_verify($validated['password'], $user->password)) {
            return response()->json(['errors' => [[
                'code' => 'INVALID_CREDENTIALS',
                'message' => 'Email hoặc mật khẩu không đúng.',
            ]]], 401);
        }

        $user->tokens()->where('name', 'busnext-mobile')->delete();
        $token = $user->createToken('busnext-mobile')->plainTextToken;

        return response()->json(['data' => [
            'user' => $user,
            'token' => $token,
        ]]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();
        return response()->json(['data' => ['logged_out' => true]]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()]);
    }

    public function favorites(Request $request): JsonResponse
    {
        $type = $request->query('type');
        $version = $this->activeVersion();
        $favorites = Favorite::query()
            ->where('user_id', $request->user()->id)
            ->when($type !== null, fn ($query) => $query->where('type', $type))
            ->orderByDesc('created_at')
            ->get(['id', 'type', 'entity_id', 'created_at']);

        $entities = $this->favoriteEntities($favorites, $version?->id);
        $data = $favorites->map(function (Favorite $favorite) use ($entities): array {
            $entityKey = $favorite->type . ':' . $favorite->entity_id;
            return [
                'id' => $favorite->id,
                'type' => $favorite->type,
                'entity_id' => $favorite->entity_id,
                'entity' => $entities[$entityKey] ?? null,
                'created_at' => $favorite->created_at?->toISOString(),
            ];
        })->values();

        return response()->json([
            'data' => $data,
            'meta' => ['count' => $data->count(), 'version' => $version?->id],
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    public function storeFavorite(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(['stop', 'route'])],
            'entity_id' => ['required', 'string', 'max:120'],
        ]);

        $version = $this->activeVersion();
        if ($version === null || !$this->favoriteEntityExists($validated['type'], $validated['entity_id'], (int) $version->id)) {
            return response()->json(['errors' => [[
                'code' => 'ENTITY_NOT_FOUND',
                'message' => 'Không tìm thấy trạm hoặc tuyến trong dữ liệu đang hoạt động.',
            ]]], 404);
        }

        $favorite = Favorite::query()->firstOrCreate([
            'user_id' => $request->user()->id,
            'type' => $validated['type'],
            'entity_id' => $validated['entity_id'],
        ]);

        return response()->json(['data' => $favorite], $favorite->wasRecentlyCreated ? 201 : 200);
    }

    private function activeVersion(): ?object
    {
        return DB::table('datasets')
            ->join('dataset_versions', 'dataset_versions.id', '=', 'datasets.active_version_id')
            ->where('dataset_versions.status', 'active')
            ->orderByDesc('dataset_versions.activated_at')
            ->first(['dataset_versions.id']);
    }

    /** @param \Illuminate\Support\Collection<int, Favorite> $favorites */
    private function favoriteEntities($favorites, ?int $versionId): array
    {
        if ($versionId === null || $favorites->isEmpty()) return [];

        $stopIds = $favorites->where('type', 'stop')->pluck('entity_id')->all();
        $routeIds = $favorites->where('type', 'route')->pluck('entity_id')->all();
        $entities = [];

        if ($stopIds !== []) {
            foreach (DB::table('stops')->where('dataset_version_id', $versionId)->whereIn('stop_id', $stopIds)->get(['stop_id', 'code', 'name', 'lat', 'lon']) as $stop) {
                $entities['stop:' . $stop->stop_id] = $stop;
            }
        }
        if ($routeIds !== []) {
            foreach (DB::table('routes as route')
                ->leftJoin('agencies as agency', 'agency.id', '=', 'route.agency_id')
                ->where('route.dataset_version_id', $versionId)
                ->whereIn('route.route_id', $routeIds)
                ->get(['route.route_id', 'route.short_name', 'route.long_name', 'route.route_type', 'agency.name as agency_name']) as $route) {
                $entities['route:' . $route->route_id] = $route;
            }
        }
        return $entities;
    }

    private function favoriteEntityExists(string $type, string $entityId, int $versionId): bool
    {
        $table = $type === 'stop' ? 'stops' : 'routes';
        $key = $type === 'stop' ? 'stop_id' : 'route_id';
        return DB::table($table)->where('dataset_version_id', $versionId)->where($key, $entityId)->exists();
    }

    public function destroyFavorite(Request $request, Favorite $favorite): JsonResponse
    {
        abort_unless($favorite->user_id === $request->user()->id, 404);
        $favorite->delete();
        return response()->json(['data' => ['deleted' => true]]);
    }
}
