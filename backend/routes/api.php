<?php

declare(strict_types=1);

use App\Http\Controllers\Api\DatasetVersionController;
use App\Http\Controllers\Api\LookupController;
use App\Http\Controllers\Api\RouteController;
use App\Http\Controllers\Api\StopController;
use App\Http\Controllers\Api\TripController;
use App\Models\Dataset;
use App\Models\DatasetVersion;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| BusFast API
|--------------------------------------------------------------------------
|
| Two route shapes are exposed for lookups: a dataset-scoped form that binds
| the version implicitly through the dataset, and a flat form that falls back
| to the most recently activated version. All GTFS endpoints answer from the
| active version only; newer imports stay invisible until activated.
|
*/

Route::get('/', static fn () => response()->json([
    'app' => 'BusFast API',
    'version' => '1.0.0',
    'timezone' => 'Asia/Ho_Chi_Minh',
]));

Route::get('/health', static fn () => response()->json([
    'status' => 'ok',
    'timestamp' => now()->toIso8601String(),
    'database' => rescue(static fn () => DB::connection()->getPdo() !== null, false, false),
]));

Route::prefix('v1')->group(function (): void {
    /* ----------------------------- datasets ----------------------------- */

    Route::get('/datasets', static fn () => response()->json([
        'data' => Dataset::query()->with('activeVersion')->paginate(20),
    ]));

    Route::get('/datasets/{datasetId}/versions', [DatasetVersionController::class, 'index']);
    Route::post('/datasets/{datasetId}/versions', [DatasetVersionController::class, 'store']);
    Route::get('/versions/{version}/validation', [DatasetVersionController::class, 'validation'])->name('versions.validation');
    Route::post('/versions/{version}/activate', [DatasetVersionController::class, 'activate']);

    /* ------------------------- dataset-scoped GTFS ------------------------ */

    Route::prefix('datasets/{dataset}')->group(function (): void {
        Route::get('/stops', [StopController::class, 'index']);
        Route::get('/stops/nearby', [StopController::class, 'nearby']);
        Route::get('/stops/{stopId}', [StopController::class, 'show']);
        Route::get('/stops/{stopId}/departures', [StopController::class, 'departures']);

        Route::get('/routes', [RouteController::class, 'index']);
        Route::get('/routes/{routeId}', [RouteController::class, 'show']);
        Route::get('/routes/{routeId}/trips', [RouteController::class, 'trips']);

        Route::get('/trips/{tripId}', [TripController::class, 'show']);
        Route::get('/trips/{tripId}/stop-times', [TripController::class, 'stopTimes']);
    });

    /* ----------------------- active-version lookups ---------------------- */

    Route::prefix('gtfs')->group(function (): void {
        Route::get('/stops', [StopController::class, 'index']);
        Route::get('/stops/nearby', [StopController::class, 'nearby']);
        Route::get('/stops/{stopId}', [StopController::class, 'show']);
        Route::get('/stops/{stopId}/departures', [StopController::class, 'departures']);

        Route::get('/routes', [RouteController::class, 'index']);
        Route::get('/routes/{routeId}', [RouteController::class, 'show']);
        Route::get('/routes/{routeId}/trips', [RouteController::class, 'trips']);

        Route::get('/trips/{tripId}', [TripController::class, 'show']);
        Route::get('/trips/{tripId}/stop-times', [TripController::class, 'stopTimes']);
    });

    /* ------------------------------ search ------------------------------- */

    Route::get('/search', [LookupController::class, 'search']);
});

Route::bind('dataset', static fn (string $value): Dataset => Dataset::query()->findOrFail($value));
Route::bind('datasetId', static fn (string $value): Dataset => Dataset::query()->findOrFail($value));
Route::bind('version', static fn (string $value): DatasetVersion => DatasetVersion::query()->findOrFail($value));
