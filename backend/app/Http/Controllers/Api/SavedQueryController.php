<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Dataset;
use App\Models\SavedQuery;
use App\Services\SavedQueryRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class SavedQueryController
{
    public function index(Dataset $datasetId): JsonResponse
    {
        return response()->json([
            'data' => SavedQuery::query()->where('dataset_id', $datasetId->id)->orderBy('id')->get(),
        ]);
    }

    public function store(Request $request, Dataset $datasetId): JsonResponse
    {
        $query = SavedQuery::query()->create(['dataset_id' => $datasetId->id, ...$this->validated($request)]);

        return response()->json(['data' => $query], 201);
    }

    public function update(Request $request, SavedQuery $savedQuery): JsonResponse
    {
        $savedQuery->update($this->validated($request));

        return response()->json(['data' => $savedQuery->refresh()]);
    }

    public function destroy(SavedQuery $savedQuery): JsonResponse
    {
        $savedQuery->delete();

        return response()->json(null, 204);
    }

    public function run(SavedQuery $savedQuery, SavedQueryRunner $runner): JsonResponse
    {
        return response()->json(['data' => $runner->run($savedQuery)]);
    }

    /** Re-run every saved query of the dataset, e.g. right after switching versions. */
    public function runAll(Dataset $datasetId, SavedQueryRunner $runner): JsonResponse
    {
        $results = SavedQuery::query()->where('dataset_id', $datasetId->id)->orderBy('id')->get()
            ->map(static fn (SavedQuery $query): array => $runner->run($query))
            ->all();

        return response()->json([
            'data' => $results,
            'meta' => [
                'count' => count($results),
                'failed' => count(array_filter($results, static fn (array $result): bool => !$result['ok'])),
                'version' => $datasetId->active_version_id,
            ],
        ]);
    }

    /** @return array{name: string, type: string, params: array<string, mixed>} */
    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', 'string', Rule::in(array_keys(SavedQuery::TYPES))],
            'params' => ['required', 'array'],
            'params.*' => ['nullable', 'max:120'],
            'params.date' => ['nullable', 'date_format:Y-m-d'],
            'params.time' => ['nullable', 'date_format:H:i:s'],
            'params.limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'params.max_transfers' => ['nullable', 'integer', 'min:0', 'max:1'],
        ]);

        $spec = SavedQuery::TYPES[$validated['type']];
        $params = array_intersect_key($validated['params'], array_flip($spec['allowed']));

        $errors = [];
        foreach ($params as $key => $value) {
            if ($value !== null && !is_scalar($value)) {
                $errors["params.{$key}"] = "The {$key} parameter must be a single value.";
            }
        }
        foreach ($spec['required'] as $key) {
            if (($params[$key] ?? '') === '') {
                $errors["params.{$key}"] = "The {$key} parameter is required for this query type.";
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return ['name' => $validated['name'], 'type' => $validated['type'], 'params' => $params];
    }
}
