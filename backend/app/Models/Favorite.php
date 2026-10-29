<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class Favorite extends Model
{
    protected $fillable = ['user_id', 'type', 'entity_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
