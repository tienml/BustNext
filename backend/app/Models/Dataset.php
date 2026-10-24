<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Dataset extends Model
{
    protected $fillable = ['slug', 'name', 'timezone', 'active_version_id'];

    public function versions(): HasMany
    {
        return $this->hasMany(DatasetVersion::class)->orderByDesc('version_number');
    }

    public function activeVersion(): BelongsTo
    {
        return $this->belongsTo(DatasetVersion::class, 'active_version_id');
    }
}
