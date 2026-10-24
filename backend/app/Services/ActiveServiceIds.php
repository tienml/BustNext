<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Resolves which service_ids operate on a given calendar date for a version.
 *
 * GTFS splits this across two files: calendar.txt holds recurring weekly
 * patterns, calendar_dates.txt holds per-date exceptions (1 = added,
 * 2 = removed). A date is active when it is inside the calendar range, the
 * weekday flag is set, and the service was not removed by an exception —
 * plus any service explicitly added by an exception.
 */
final class ActiveServiceIds
{
    /** @return list<string> */
    public function forDate(int $datasetVersionId, string $date): array
    {
        $weekday = strtolower((string) date('l', strtotime($date)));

        $scheduled = DB::table('calendar_services')
            ->where('dataset_version_id', $datasetVersionId)
            ->where('start_date', '<=', $date)
            ->where('end_date', '>=', $date)
            ->where($weekday, true)
            ->pluck('service_id')
            ->all();

        $exceptions = DB::table('calendar_dates')
            ->where('dataset_version_id', $datasetVersionId)
            ->where('date', $date)
            ->get(['service_id', 'exception_type']);

        $removed = [];
        $added = [];
        foreach ($exceptions as $exception) {
            if ((int) $exception->exception_type === 2) {
                $removed[] = $exception->service_id;
            } else {
                $added[] = $exception->service_id;
            }
        }

        $active = array_values(array_diff($scheduled, $removed));
        foreach ($added as $serviceId) {
            if (!in_array($serviceId, $active, true)) {
                $active[] = $serviceId;
            }
        }

        return $active;
    }
}
