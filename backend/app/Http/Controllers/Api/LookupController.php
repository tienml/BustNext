<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Dataset;
use App\Models\Stop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class LookupController
{
    public function stops(Request $request, Dataset $dataset): JsonResponse
    {
        $version = $dataset->activeVersion;
        if ($version === null) return response()->json(['data' => [], 'meta' => ['version' => null]]);
        $query = trim((string) $request->query('q', ''));
        $stops = Stop::query()->where('dataset_version_id', $version->id)
            ->when($query !== '', fn ($builder) => $builder->where(fn ($q) => $q->where('stop_id', 'like', "%{$query}%")->orWhere('name', 'like', "%{$query}%")))
            ->orderBy('name')->paginate(min((int) $request->query('limit', 20), 100));
        return response()->json(['data' => $stops, 'meta' => ['version' => $version->id, 'timezone' => $version->timezone]]);
    }

    /**
     * Unified search across stops and routes of the active version.
     *
     * The home screen search box hits this endpoint: one query, both entity
     * types, grouped so the client can render sections without extra calls.
     */
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:1', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $query = trim($validated['q']);
        $limit = (int) ($validated['limit'] ?? 10);

        $version = DB::table('datasets')
            ->join('dataset_versions', 'dataset_versions.id', '=', 'datasets.active_version_id')
            ->where('dataset_versions.status', 'active')
            ->orderByDesc('dataset_versions.activated_at')
            ->first(['dataset_versions.id', 'dataset_versions.timezone']);

        if ($version === null) {
            return response()->json(['data' => ['stops' => [], 'routes' => []], 'meta' => ['version' => null]]);
        }

        $stops = DB::table('stops')
            ->where('dataset_version_id', $version->id)
            ->where(fn ($builder) => $builder
                ->where('stop_id', 'like', "%{$query}%")
                ->orWhere('code', 'like', "%{$query}%")
                ->orWhere('name', 'like', "%{$query}%"))
            ->orderBy('name')
            ->limit($limit)
            ->get(['stop_id', 'code', 'name', 'lat', 'lon']);

        $routes = DB::table('routes as r')
            ->leftJoin('agencies as a', 'a.id', '=', 'r.agency_id')
            ->where('r.dataset_version_id', $version->id)
            ->where(fn ($builder) => $builder
                ->where('r.route_id', 'like', "%{$query}%")
                ->orWhere('r.short_name', 'like', "%{$query}%")
                ->orWhere('r.long_name', 'like', "%{$query}%"))
            ->orderBy('r.short_name')
            ->limit($limit)
            ->get(['r.route_id', 'r.short_name', 'r.long_name', 'r.route_type', 'a.name as agency_name']);

        return response()->json([
            'data' => ['stops' => $stops, 'routes' => $routes],
            'meta' => [
                'query' => $query,
                'version' => $version->id,
                'timezone' => $version->timezone,
                'counts' => ['stops' => $stops->count(), 'routes' => $routes->count()],
            ],
        ]);
    }
}
