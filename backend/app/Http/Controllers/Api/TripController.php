<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Dataset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Trip lookups against the active dataset version.
 *
 * Stop times are returned in GTFS order with both the raw "25:10:00" text and
 * the integer seconds used for all comparisons.
 */
final class TripController
{
    public function show(Request $request, string $tripId, ?Dataset $dataset = null): JsonResponse
    {
        $version = $this->resolveVersion($dataset);
        if ($version === null) {
            return $this->noActiveVersion();
        }

        $trip = DB::table('trips as t')
            ->leftJoin('routes as r', function ($join): void {
                $join->on('r.dataset_version_id', '=', 't.dataset_version_id')
                    ->on('r.route_id', '=', 't.route_id');
            })
            ->leftJoin('agencies as a', 'a.id', '=', 'r.agency_id')
            ->where('t.dataset_version_id', $version->id)
            ->where('t.trip_id', $tripId)
            ->first([
                't.trip_id', 't.route_id', 't.service_id', 't.headsign', 't.direction_id',
                'r.short_name', 'r.long_name', 'r.route_type',
                'a.name as agency_name',
            ]);

        if ($trip === null) {
            return response()->json(['errors' => [['code' => 'TRIP_NOT_FOUND', 'message' => 'Trip not found']]], 404);
        }

        return response()->json([
            'data' => $trip,
            'stop_times' => $this->stopTimesFor($version->id, $tripId),
            'meta' => ['version' => $version->id],
        ]);
    }

    public function stopTimes(Request $request, string $tripId, ?Dataset $dataset = null): JsonResponse
    {
        $version = $this->resolveVersion($dataset);
        if ($version === null) {
            return $this->noActiveVersion();
        }

        $stopTimes = $this->stopTimesFor($version->id, $tripId);
        if ($stopTimes === []) {
            return response()->json(['errors' => [['code' => 'TRIP_NOT_FOUND', 'message' => 'Trip not found']]], 404);
        }

        return response()->json([
            'data' => $stopTimes,
            'meta' => ['trip_id' => $tripId, 'count' => count($stopTimes), 'version' => $version->id],
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function stopTimesFor(int $versionId, string $tripId): array
    {
        $rows = DB::table('stop_times as st')
            ->leftJoin('stops as s', function ($join): void {
                $join->on('s.dataset_version_id', '=', 'st.dataset_version_id')
                    ->on('s.stop_id', '=', 'st.stop_id');
            })
            ->where('st.dataset_version_id', $versionId)
            ->where('st.trip_id', $tripId)
            ->orderBy('st.stop_sequence')
            ->get([
                'st.stop_sequence', 'st.stop_id',
                'st.arrival_seconds', 'st.departure_seconds',
                'st.arrival_raw', 'st.departure_raw',
                's.code', 's.name', 's.lat', 's.lon',
            ]);

        return $rows->map(static fn (object $row): array => [
            'stop_sequence' => (int) $row->stop_sequence,
            'stop_id' => $row->stop_id,
            'stop_code' => $row->code,
            'stop_name' => $row->name,
            'lat' => $row->lat,
            'lon' => $row->lon,
            'arrival_time' => $row->arrival_raw,
            'departure_time' => $row->departure_raw,
            'arrival_seconds' => (int) $row->arrival_seconds,
            'departure_seconds' => (int) $row->departure_seconds,
        ])->all();
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
