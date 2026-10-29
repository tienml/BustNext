<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Dataset;
use App\Services\JourneyPlanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class JourneyController
{
    public function plan(Request $request, JourneyPlanner $planner, ?Dataset $dataset = null): JsonResponse
    {
        $validated = $request->validate([
            'from_stop_id' => ['required', 'string', 'max:120'],
            'to_stop_id' => ['required', 'string', 'max:120', 'different:from_stop_id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'date_format:H:i:s'],
            'max_transfers' => ['nullable', 'integer', 'min:0', 'max:1'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);

        $version = $dataset?->activeVersion;
        if ($version === null) {
            $version = DB::table('datasets')
                ->join('dataset_versions', 'dataset_versions.id', '=', 'datasets.active_version_id')
                ->where('dataset_versions.status', 'active')
                ->orderByDesc('dataset_versions.activated_at')
                ->first(['dataset_versions.*']);
        }
        if ($version === null) {
            return response()->json(['errors' => [['code' => 'NO_ACTIVE_VERSION', 'message' => 'No active dataset version']]], 404);
        }

        $originExists = DB::table('stops')->where('dataset_version_id', $version->id)->where('stop_id', $validated['from_stop_id'])->exists();
        $destinationExists = DB::table('stops')->where('dataset_version_id', $version->id)->where('stop_id', $validated['to_stop_id'])->exists();
        if (!$originExists || !$destinationExists) {
            return response()->json(['errors' => [['code' => 'STOP_NOT_FOUND', 'message' => 'Origin or destination stop not found']]], 404);
        }

        $cacheKey = implode(':', [
            'journey', $version->id, $validated['from_stop_id'], $validated['to_stop_id'],
            $validated['date'], $validated['time'],
            (int) ($validated['max_transfers'] ?? 1), (int) ($validated['limit'] ?? 5),
        ]);
        $journeys = Cache::remember($cacheKey, now()->addSeconds(15), fn (): array => $planner->plan(
            (int) $version->id,
            $validated['from_stop_id'],
            $validated['to_stop_id'],
            $validated['date'],
            $validated['time'],
            (int) ($validated['max_transfers'] ?? 1),
            (int) ($validated['limit'] ?? 5),
        ));

        return response()->json([
            'data' => $journeys,
            'meta' => [
                'from_stop_id' => $validated['from_stop_id'],
                'to_stop_id' => $validated['to_stop_id'],
                'date' => $validated['date'],
                'time' => $validated['time'],
                'timezone' => $version->timezone,
                'count' => count($journeys),
                'version' => $version->id,
            ],
        ]);
    }
}
