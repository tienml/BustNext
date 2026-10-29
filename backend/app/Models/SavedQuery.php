<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class SavedQuery extends Model
{
    /**
     * Query types: the params each type requires and the ones it accepts.
     * Params outside "allowed" are dropped before saving.
     */
    public const TYPES = [
        'stops' => ['required' => ['q'], 'allowed' => ['q', 'limit']],
        'routes' => ['required' => ['q'], 'allowed' => ['q', 'route_type', 'limit']],
        'trip' => ['required' => ['trip_id'], 'allowed' => ['trip_id']],
        'route_trips' => ['required' => ['route_id'], 'allowed' => ['route_id', 'date']],
        'departures' => ['required' => ['stop_id'], 'allowed' => ['stop_id', 'date', 'time', 'limit']],
        'journey' => [
            'required' => ['from_stop_id', 'to_stop_id', 'date', 'time'],
            'allowed' => ['from_stop_id', 'to_stop_id', 'date', 'time', 'max_transfers'],
        ],
    ];

    protected $fillable = [
        'dataset_id', 'name', 'type', 'params',
        'last_run_at', 'last_version_id', 'last_status', 'last_result_count',
    ];

    protected $casts = ['params' => 'array', 'last_run_at' => 'datetime'];

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(Dataset::class);
    }
}
