<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Dataset;
use App\Models\DatasetVersion;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class DatasetVersionService
{
    public function activate(DatasetVersion $version): DatasetVersion
    {
        return DB::transaction(function () use ($version): DatasetVersion {
            $dataset = Dataset::query()->whereKey($version->dataset_id)->lockForUpdate()->firstOrFail();
            $version->refresh();
            if (!in_array($version->status, ['ready', 'active'], true)) {
                throw new RuntimeException('Only a ready version can be activated.');
            }

            if ($dataset->active_version_id && $dataset->active_version_id !== $version->id) {
                DatasetVersion::query()->whereKey($dataset->active_version_id)->update(['status' => 'archived']);
            }
            $version->update(['status' => 'active', 'activated_at' => now()]);
            $dataset->update(['active_version_id' => $version->id]);
            return $version->fresh();
        });
    }
}
