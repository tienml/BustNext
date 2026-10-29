<?php

declare(strict_types=1);

namespace App\Services;

use App\Http\Controllers\Api\JourneyController;
use App\Http\Controllers\Api\RouteController;
use App\Http\Controllers\Api\StopController;
use App\Http\Controllers\Api\TripController;
use App\Models\Dataset;
use App\Models\SavedQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Re-runs a saved query against the dataset's active version.
 *
 * It calls the same controller actions the passenger app uses, so after a
 * version switch the saved query gets exactly the answer a passenger would.
 */
final class SavedQueryRunner
{
    /** @return array<string, mixed> */
    public function run(SavedQuery $query): array
    {
        $dataset = Dataset::query()->findOrFail($query->dataset_id);
        $params = array_filter($query->params ?? [], static fn ($value): bool => $value !== null && $value !== '');

        try {
            $response = $this->dispatch($query->type, $params, $dataset);
            $status = $response->getStatusCode();
            $body = $response->getData(true);
        } catch (ValidationException $exception) {
            $status = 422;
            $body = ['errors' => [['code' => 'INVALID_PARAMS', 'message' => $exception->getMessage(), 'fields' => $exception->errors()]]];
        }

        $count = $this->count($query->type, $body, $status);
        $versionId = $body['meta']['version'] ?? $dataset->active_version_id;

        $query->forceFill([
            'last_run_at' => now(),
            'last_version_id' => $versionId,
            'last_status' => $status,
            'last_result_count' => $count,
        ])->save();

        return [
            'query' => $query->only(['id', 'name', 'type', 'params']),
            'status' => $status,
            'ok' => $status < 400,
            'count' => $count,
            'version' => $versionId,
            'data' => $body['data'] ?? null,
            'stop_times' => $body['stop_times'] ?? null,
            'errors' => $body['errors'] ?? null,
        ];
    }

    /** @param array<string, mixed> $params */
    private function dispatch(string $type, array $params, Dataset $dataset): JsonResponse
    {
        $request = static fn (array $keys): Request => Request::create(
            '/',
            'GET',
            array_intersect_key($params, array_flip($keys)),
        );

        return match ($type) {
            'stops' => app(StopController::class)->index($request(['q', 'limit']), $dataset),
            'routes' => app(RouteController::class)->index($request(['q', 'route_type', 'limit']), $dataset),
            'trip' => app(TripController::class)->show($request([]), (string) $params['trip_id'], $dataset),
            'route_trips' => app(RouteController::class)->trips($request(['date']), (string) $params['route_id'], $dataset),
            'departures' => app(StopController::class)->departures($request(['date', 'time', 'limit']), (string) $params['stop_id'], $dataset),
            'journey' => app(JourneyController::class)->plan(
                $request(['from_stop_id', 'to_stop_id', 'date', 'time', 'max_transfers']),
                app(JourneyPlanner::class),
                $dataset,
            ),
        };
    }

    /** @param array<string, mixed> $body */
    private function count(string $type, array $body, int $status): int
    {
        if ($status >= 400) {
            return 0;
        }
        if ($type === 'trip') {
            return count($body['stop_times'] ?? []);
        }

        return is_array($body['data'] ?? null) ? count($body['data']) : 0;
    }
}
