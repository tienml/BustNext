<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Dataset;
use App\Services\ActiveServiceIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Route lookups against the active dataset version.
 *
 * Columns follow the GTFS migration: routes(route_id, short_name, long_name,
 * route_type, agency_id) with agency_id pointing at agencies.id.
 */
final class RouteController
{
    public function __construct(private readonly ActiveServiceIds $activeServices)
    {
    }

    public function index(Request $request, ?Dataset $dataset = null): JsonResponse
    {
        $version = $this->resolveVersion($dataset);
        if ($version === null) {
            return $this->noActiveVersion();
        }

        $query = trim((string) $request->query('q', ''));
        $routeType = $request->query('route_type');
        $limit = min((int) $request->query('limit', 100), 200);

        $routes = DB::table('routes as r')
            ->leftJoin('agencies as a', 'a.id', '=', 'r.agency_id')
            ->where('r.dataset_version_id', $version->id)
            ->when($query !== '', fn ($builder) => $builder->where(fn ($q) => $q
                ->where('r.route_id', 'like', "%{$query}%")
                ->orWhere('r.short_name', 'like', "%{$query}%")
                ->orWhere('r.long_name', 'like', "%{$query}%")
            ))
            ->when($routeType !== null, fn ($builder) => $builder->where('r.route_type', (int) $routeType))
            ->orderBy('r.short_name')
            ->limit($limit)
            ->get([
                'r.route_id', 'r.short_name', 'r.long_name', 'r.route_type',
                'a.name as agency_name',
            ]);

        return response()->json([
            'data' => $routes,
            'meta' => ['count' => $routes->count(), 'query' => $query, 'version' => $version->id],
        ]);
    }

    public function show(Request $request, string $routeId, ?Dataset $dataset = null): JsonResponse
    {
        $version = $this->resolveVersion($dataset);
        if ($version === null) {
            return $this->noActiveVersion();
        }

        $route = DB::table('routes as r')
            ->leftJoin('agencies as a', 'a.id', '=', 'r.agency_id')
            ->where('r.dataset_version_id', $version->id)
            ->where('r.route_id', $routeId)
            ->first([
                'r.route_id', 'r.short_name', 'r.long_name', 'r.route_type',
                'a.name as agency_name', 'a.timezone as agency_timezone',
            ]);

        if ($route === null) {
            return response()->json(['errors' => [['code' => 'ROUTE_NOT_FOUND', 'message' => 'Route not found']]], 404);
        }

        $stopIds = DB::table('stop_times as st')
            ->join('trips as t', function ($join): void {
                $join->on('t.dataset_version_id', '=', 'st.dataset_version_id')
                    ->on('t.trip_id', '=', 'st.trip_id');
            })
            ->where('t.dataset_version_id', $version->id)
            ->where('t.route_id', $routeId)
            ->distinct()
            ->pluck('st.stop_id')
            ->all();

        $stops = $stopIds === [] ? collect() : DB::table('stops')
            ->where('dataset_version_id', $version->id)
            ->whereIn('stop_id', $stopIds)
            ->orderBy('name')
            ->get(['stop_id', 'code', 'name', 'lat', 'lon']);

        $tripCount = DB::table('trips')
            ->where('dataset_version_id', $version->id)
            ->where('route_id', $routeId)
            ->count();

        return response()->json([
            'data' => $route,
            'stops' => $stops,
            'meta' => ['stop_count' => $stops->count(), 'trip_count' => $tripCount, 'version' => $version->id],
        ]);
    }

    /**
     * Trips of a route that operate on the given date, ordered by first departure.
     */
    public function trips(Request $request, string $routeId, ?Dataset $dataset = null): JsonResponse
    {
        $validated = $request->validate(['date' => ['nullable', 'date_format:Y-m-d']]);
        $version = $this->resolveVersion($dataset);
        if ($version === null) {
            return $this->noActiveVersion();
        }

        $date = $validated['date'] ?? date('Y-m-d');
        $serviceIds = $this->activeServices->forDate($version->id, $date);

        if ($serviceIds === []) {
            return response()->json([
                'data' => [],
                'meta' => ['route_id' => $routeId, 'date' => $date, 'count' => 0, 'version' => $version->id],
            ]);
        }

        $trips = DB::table('trips')
            ->where('dataset_version_id', $version->id)
            ->where('route_id', $routeId)
            ->whereIn('service_id', $serviceIds)
            ->get(['trip_id', 'headsign', 'direction_id', 'service_id']);

        foreach ($trips as $trip) {
            $first = DB::table('stop_times')
                ->where('dataset_version_id', $version->id)
                ->where('trip_id', $trip->trip_id)
                ->orderBy('stop_sequence')
                ->first(['departure_seconds', 'departure_raw']);

            $trip->departure_seconds = $first?->departure_seconds;
            $trip->departure_time = $first?->departure_raw;
        }

        $sorted = collect($trips)->sortBy('departure_seconds')->values();

        return response()->json([
            'data' => $sorted,
            'meta' => ['route_id' => $routeId, 'date' => $date, 'count' => $sorted->count(), 'version' => $version->id],
        ]);
    }

    private function resolveVersion(?Dataset $dataset): ?object
    {
        if ($dataset !== null) {
            return $dataset->activeVersion;
        }

        return DB::table('datasets')
            ->join('dataset_versions', 'dataset_versions.id', '=', 'datasets.active_version_id')
            ->where('dataset_versions.status', 'active')
            ->orderByDesc('dataset_versions.activated_at')
            ->first(['dataset_versions.*']);
    }

    private function noActiveVersion(): JsonResponse
    {
        return response()->json(['errors' => [['code' => 'NO_ACTIVE_VERSION', 'message' => 'No active dataset version']]], 404);
    }
}
