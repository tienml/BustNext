<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class DatasetVersion extends Model
{
    public const STATUSES = ['pending', 'validating', 'failed', 'ready', 'active', 'archived'];

    protected $fillable = [
        'dataset_id', 'version_number', 'label', 'status', 'source_filename', 'sha256',
        'timezone', 'stats', 'error_count', 'warning_count', 'imported_by', 'imported_at', 'activated_at',
    ];

    protected $casts = ['stats' => 'array', 'activated_at' => 'datetime'];

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(Dataset::class);
    }

    public function validationErrors(): HasMany
    {
        return $this->hasMany(ValidationErrorRecord::class, 'dataset_version_id');
    }
}
