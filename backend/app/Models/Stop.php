<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class Stop extends Model
{
    protected $fillable = ['dataset_version_id', 'stop_id', 'code', 'name', 'lat', 'lon'];

    public function version(): BelongsTo
    {
        return $this->belongsTo(DatasetVersion::class, 'dataset_version_id');
    }
}
