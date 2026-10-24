<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class ValidationErrorRecord extends Model
{
    protected $table = 'validation_errors';
    protected $fillable = ['dataset_version_id', 'file_name', 'row_number', 'column_name', 'code', 'severity', 'message', 'value'];

    public function version(): BelongsTo
    {
        return $this->belongsTo(DatasetVersion::class, 'dataset_version_id');
    }
}
