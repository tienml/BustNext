<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Dataset;
use App\Models\DatasetVersion;
use App\Services\DatasetVersionService;
use App\Services\GtfsImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Throwable;

final class DatasetVersionController
{
    public function index(string $datasetId): JsonResponse
    {
        $dataset = Dataset::query()->findOrFail($datasetId);
        $versions = DatasetVersion::query()
            ->where('dataset_id', $dataset->id)
            ->orderByDesc('version_number')
            ->paginate(20);

        return response()->json(['data' => $versions]);
    }

    public function validation(DatasetVersion $version): JsonResponse
    {
        return response()->json(['data' => $version->validationErrors()->paginate(50)]);
    }

    public function activate(DatasetVersion $version, DatasetVersionService $service): JsonResponse
    {
        try {
            $activated = $service->activate($version);
            return response()->json(['data' => $activated]);
        } catch (Throwable $exception) {
            return response()->json(['errors' => [['code' => 'VERSION_NOT_READY', 'message' => $exception->getMessage()]]], 422);
        }
    }

    public function store(Request $request, string $datasetId, GtfsImportService $importer): JsonResponse
    {
        $dataset = Dataset::query()->findOrFail($datasetId);
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:zip', 'max:51200'],
            'label' => ['nullable', 'string', 'max:120'],
            'process' => ['nullable', 'boolean'],
        ]);
        $file = $request->file('file');
        $next = ((int) $dataset->versions()->max('version_number')) + 1;
        $version = DatasetVersion::query()->create([
            'dataset_id' => $dataset->id,
            'version_number' => $next,
            'label' => $validated['label'] ?? null,
            'status' => 'pending',
            'source_filename' => $file->getClientOriginalName(),
            'sha256' => hash_file('sha256', $file->getRealPath()),
            'timezone' => $dataset->timezone,
        ]);

        // Synchronous by default so the API result is immediately useful in
        // local development. Queue this call later for large operator feeds.
        if (($validated['process'] ?? true) === true) {
            $result = $importer->import($version, $file->getRealPath());
            $status = $result['status'] === 'ready' ? 201 : 422;
            return response()->json($result, $status);
        }

        return response()->json(['data' => $version], 202);
    }
}
