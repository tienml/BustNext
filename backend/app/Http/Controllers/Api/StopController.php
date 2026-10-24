<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Dataset;
use App\Services\ActiveServiceIds;
use DateTimeImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Stop lookups against the active dataset version.
 *
 * Columns follow the GTFS migration: stops(name, code, lat, lon) and
 * stop_times(arrival_seconds, departure_seconds). Times are stored as integer
 * seconds from the service date so 25:10:00 survives as 90600.
 */
final class StopController
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
        $limit = min((int) $request->query('limit', 20), 100);

        $stops = DB::table('stops')
            ->where('dataset_version_id', $version->id)
            ->when($query !== '', fn ($builder) => $builder->where(fn ($q) => $q
                ->where('stop_id', 'like', "%{$query}%")
                ->orWhere('code', 'like', "%{$query}%")
                ->orWhere('name', 'like', "%{$query}%")
            ))
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'stop_id', 'code', 'name', 'lat', 'lon']);

        return response()->json([
            'data' => $stops,
            'meta' => ['count' => $stops->count(), 'query' => $query, 'version' => $version->id],
        ]);
    }

    public function show(Request $request, string $stopId, ?Dataset $dataset = null): JsonResponse
    {
        $version = $this->resolveVersion($dataset);
        if ($version === null) {
            return $this->noActiveVersion();
        }

        $stop = DB::table('stops')
            ->where('dataset_version_id', $version->id)
            ->where('stop_id', $stopId)
            ->first(['id', 'stop_id', 'code', 'name', 'lat', 'lon']);

        if ($stop === null) {
            return response()->json(['errors' => [['code' => 'STOP_NOT_FOUND', 'message' => 'Stop not found']]], 404);
        }

        return response()->json([
            'data' => $stop,
            'meta' => ['version' => $version->id],
        ]);
    }

    /**
     * Stops within a radius of a coordinate, nearest first.
     */
    public function nearby(Request $request, ?Dataset $dataset = null): JsonResponse
    {
        $validated = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lon' => ['required', 'numeric', 'between:-180,180'],
            'radius' => ['nullable', 'integer', 'min:50', 'max:10000'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $version = $this->resolveVersion($dataset);
        if ($version === null) {
            return $this->noActiveVersion();
        }

        $lat = (float) $validated['lat'];
        $lon = (float) $validated['lon'];
        $radius = (int) ($validated['radius'] ?? 1000);
        $limit = (int) ($validated['limit'] ?? 20);

        $distanceSql = sprintf(
            '(6371000 * 2 * asin(sqrt(power(sin(radians(lat - %1$s) / 2), 2)'
            . ' + cos(radians(%1$s)) * cos(radians(lat)) * power(sin(radians(lon - %2$s) / 2), 2))))',
            $this->number($lat),
            $this->number($lon),
        );

        $stops = DB::table('stops')
            ->where('dataset_version_id', $version->id)
            ->whereNotNull('lat')
            ->whereNotNull('lon')
            ->whereRaw("{$distanceSql} <= ?", [$radius])
            ->select(['stop_id', 'code', 'name', 'lat', 'lon'])
            ->selectRaw("{$distanceSql} AS distance_meters")
            ->orderBy('distance_meters')
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $stops,
            'meta' => [
                'lat' => $lat, 'lon' => $lon, 'radius' => $radius,
                'count' => $stops->count(), 'version' => $version->id,
            ],
        ]);
    }

    /**
     * Next departures from a stop. Looks at the requested service date and the
     * previous one, because a 01:10 departure on calendar day D may belong to a
     * 25:10 trip whose service date is D-1.
     */
    public function departures(Request $request, string $stopId, ?Dataset $dataset = null): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'time' => ['nullable', 'date_format:H:i:s'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $version = $this->resolveVersion($dataset);
        if ($version === null) {
            return $this->noActiveVersion();
        }

        $date = $validated['date'] ?? date('Y-m-d');
        $time = $validated['time'] ?? date('H:i:s');
        $limit = (int) ($validated['limit'] ?? 10);
        $nowSeconds = $this->toSeconds($time);

        // "Now" is anchored to the requested date, once. Rows from the previous
        // service date are compared against the same instant, so a 25:10 trip
        // from D-1 is ten minutes away at 01:00 on D — not a day away.
        $absoluteNow = strtotime($date . ' 00:00:00') + $nowSeconds;

        $serviceDates = [
            (new DateTimeImmutable($date))->modify('-1 day')->format('Y-m-d'),
            $date,
        ];

        $rows = [];
        foreach ($serviceDates as $serviceDate) {
            $serviceIds = $this->activeServices->forDate($version->id, $serviceDate);
            if ($serviceIds === []) {
                continue;
            }

            $departures = DB::table('stop_times as st')
                ->join('trips as t', function ($join): void {
                    $join->on('t.dataset_version_id', '=', 'st.dataset_version_id')
                        ->on('t.trip_id', '=', 'st.trip_id');
                })
                ->join('routes as r', function ($join): void {
                    $join->on('r.dataset_version_id', '=', 't.dataset_version_id')
                        ->on('r.route_id', '=', 't.route_id');
                })
                ->leftJoin('agencies as a', 'a.id', '=', 'r.agency_id')
                ->where('st.dataset_version_id', $version->id)
                ->where('st.stop_id', $stopId)
                ->whereIn('t.service_id', $serviceIds)
                ->orderBy('st.departure_seconds')
                ->get([
                    'st.trip_id', 'st.departure_seconds', 'st.departure_raw', 'st.stop_sequence',
                    't.headsign', 't.route_id',
                    'r.short_name', 'r.long_name', 'r.route_type',
                    'a.name as agency_name',
                ]);

            foreach ($departures as $departure) {
                $absolute = strtotime($serviceDate . ' 00:00:00') + (int) $departure->departure_seconds;
                if ($absolute < $absoluteNow) {
                    continue;
                }

                $rows[] = [
                    'trip_id' => $departure->trip_id,
                    'route_id' => $departure->route_id,
                    'route_short_name' => $departure->short_name,
                    'route_long_name' => $departure->long_name,
                    'route_type' => $departure->route_type,
                    'agency_name' => $departure->agency_name,
                    'headsign' => $departure->headsign,
                    'stop_sequence' => $departure->stop_sequence,
                    'service_date' => $serviceDate,
                    'departure_time' => $departure->departure_raw,
                    'departure_seconds' => (int) $departure->departure_seconds,
                    'absolute_timestamp' => $absolute,
                    'minutes_until' => (int) max(0, round(($absolute - $absoluteNow) / 60)),
                ];
            }
        }

        usort($rows, static fn (array $a, array $b): int => $a['absolute_timestamp'] <=> $b['absolute_timestamp']);
        $rows = array_slice($rows, 0, $limit);

        return response()->json([
            'data' => $rows,
            'meta' => [
                'stop_id' => $stopId, 'date' => $date, 'time' => $time,
                'count' => count($rows), 'version' => $version->id,
            ],
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

    private function toSeconds(string $time): int
    {
        [$hours, $minutes, $seconds] = array_map('intval', explode(':', $time));
        return $hours * 3600 + $minutes * 60 + $seconds;
    }

    private function number(float $value): string
    {
        return rtrim(rtrim(sprintf('%.8F', $value), '0'), '.');
    }
}
