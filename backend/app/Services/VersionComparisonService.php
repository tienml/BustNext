<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DatasetVersion;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Compares two imported versions of the same dataset by route and by trip.
 *
 * A trip is matched across versions by trip_id. It is "added" when only the
 * target has it, "removed" when only the base has it, and "changed" when both
 * have it but its attributes or any stop time (stop, arrival, departure at a
 * stop_sequence) differ. Raw GTFS times are compared, so 25:10:00 stays distinct
 * from 01:10:00.
 */
final class VersionComparisonService
{
    private const TRIP_FIELDS = ['route_id', 'service_id', 'headsign', 'direction_id'];
    private const ROUTE_FIELDS = ['short_name', 'long_name', 'route_type'];

    /** @return array<string, mixed> */
    public function compare(DatasetVersion $base, DatasetVersion $target): array
    {
        if ($base->dataset_id !== $target->dataset_id) {
            throw new InvalidArgumentException('Both versions must belong to the same dataset.');
        }
        if ($base->id === $target->id) {
            throw new InvalidArgumentException('Choose two different versions to compare.');
        }

        $routes = $this->compareRoutes($base->id, $target->id);
        $trips = $this->compareTrips($base->id, $target->id);

        return [
            'base' => $this->versionSummary($base),
            'target' => $this->versionSummary($target),
            'summary' => [
                'routes_added' => count($routes['added']),
                'routes_removed' => count($routes['removed']),
                'routes_changed' => count($routes['changed']),
                'trips_added' => count($trips['added']),
                'trips_removed' => count($trips['removed']),
                'trips_changed' => count($trips['changed']),
            ],
            'routes' => $routes,
            'trips' => $trips,
            'by_route' => $this->groupByRoute($trips),
        ];
    }

    /** @return array{added: list<array<string, mixed>>, removed: list<array<string, mixed>>, changed: list<array<string, mixed>>} */
    private function compareRoutes(int $baseId, int $targetId): array
    {
        $columns = ['route_id', ...self::ROUTE_FIELDS];
        $base = DB::table('routes')->where('dataset_version_id', $baseId)->get($columns)->keyBy('route_id');
        $target = DB::table('routes')->where('dataset_version_id', $targetId)->get($columns)->keyBy('route_id');

        return $this->diffKeyed($base->all(), $target->all(), self::ROUTE_FIELDS, 'route_id');
    }

    /** @return array{added: list<array<string, mixed>>, removed: list<array<string, mixed>>, changed: list<array<string, mixed>>} */
    private function compareTrips(int $baseId, int $targetId): array
    {
        $columns = ['trip_id', ...self::TRIP_FIELDS];
        $base = DB::table('trips')->where('dataset_version_id', $baseId)->get($columns)->keyBy('trip_id')->all();
        $target = DB::table('trips')->where('dataset_version_id', $targetId)->get($columns)->keyBy('trip_id')->all();

        $result = $this->diffKeyed($base, $target, self::TRIP_FIELDS, 'trip_id');

        // Stop-time differences, only for trips present in both versions.
        $changedById = [];
        foreach ($result['changed'] as $entry) {
            $changedById[$entry['trip_id']] = $entry;
        }
        foreach ($this->stopTimeDifferences($baseId, $targetId) as $tripId => $stopChanges) {
            if (!isset($base[$tripId], $target[$tripId])) {
                continue;
            }
            $changedById[$tripId] ??= [
                'trip_id' => $tripId,
                'route_id' => $target[$tripId]->route_id,
                'changes' => [],
            ];
            $changedById[$tripId]['stop_times'] = $stopChanges;
        }

        ksort($changedById, SORT_STRING);
        $result['changed'] = array_values(array_map(static function (array $entry): array {
            $entry['stop_times'] ??= [];
            return $entry;
        }, $changedById));

        return $result;
    }

    /**
     * @param array<string, object> $base
     * @param array<string, object> $target
     * @param list<string> $fields
     * @return array{added: list<array<string, mixed>>, removed: list<array<string, mixed>>, changed: list<array<string, mixed>>}
     */
    private function diffKeyed(array $base, array $target, array $fields, string $key): array
    {
        $added = [];
        $removed = [];
        $changed = [];

        foreach ($target as $id => $row) {
            if (!isset($base[$id])) {
                $added[] = (array) $row;
            }
        }
        foreach ($base as $id => $row) {
            if (!isset($target[$id])) {
                $removed[] = (array) $row;
                continue;
            }
            $changes = [];
            foreach ($fields as $field) {
                $from = $row->{$field};
                $to = $target[$id]->{$field};
                if ((string) $from !== (string) $to) {
                    $changes[] = ['field' => $field, 'from' => $from, 'to' => $to];
                }
            }
            if ($changes !== []) {
                $entry = [$key => (string) $id, 'changes' => $changes];
                if ($key === 'trip_id') {
                    $entry['route_id'] = $target[$id]->route_id;
                }
                $changed[] = $entry;
            }
        }

        $sort = static fn (array $a, array $b): int => strcmp((string) $a[$key], (string) $b[$key]);
        usort($added, $sort);
        usort($removed, $sort);
        usort($changed, $sort);

        return ['added' => $added, 'removed' => $removed, 'changed' => $changed];
    }

    /** @return array<string, list<array<string, mixed>>> */
    private function stopTimeDifferences(int $baseId, int $targetId): array
    {
        $rows = DB::select(
            <<<'SQL'
            SELECT COALESCE(a.trip_id, b.trip_id) AS trip_id,
                   COALESCE(a.stop_sequence, b.stop_sequence) AS stop_sequence,
                   a.stop_id AS from_stop_id, b.stop_id AS to_stop_id,
                   a.arrival_raw AS from_arrival, b.arrival_raw AS to_arrival,
                   a.departure_raw AS from_departure, b.departure_raw AS to_departure
            FROM (SELECT trip_id, stop_sequence, stop_id, arrival_raw, departure_raw FROM stop_times WHERE dataset_version_id = ?) a
            FULL OUTER JOIN (SELECT trip_id, stop_sequence, stop_id, arrival_raw, departure_raw FROM stop_times WHERE dataset_version_id = ?) b
              ON a.trip_id = b.trip_id AND a.stop_sequence = b.stop_sequence
            WHERE a.trip_id IS NULL OR b.trip_id IS NULL
               OR a.stop_id <> b.stop_id
               OR a.arrival_raw <> b.arrival_raw
               OR a.departure_raw <> b.departure_raw
            ORDER BY 1, 2
            SQL,
            [$baseId, $targetId],
        );

        $byTrip = [];
        foreach ($rows as $row) {
            $kind = match (true) {
                $row->from_stop_id === null => 'stop_added',
                $row->to_stop_id === null => 'stop_removed',
                $row->from_stop_id !== $row->to_stop_id => 'stop_changed',
                default => 'time_changed',
            };
            $byTrip[$row->trip_id][] = [
                'stop_sequence' => (int) $row->stop_sequence,
                'type' => $kind,
                'from' => $row->from_stop_id === null ? null : [
                    'stop_id' => $row->from_stop_id,
                    'arrival_time' => $row->from_arrival,
                    'departure_time' => $row->from_departure,
                ],
                'to' => $row->to_stop_id === null ? null : [
                    'stop_id' => $row->to_stop_id,
                    'arrival_time' => $row->to_arrival,
                    'departure_time' => $row->to_departure,
                ],
            ];
        }

        return $byTrip;
    }

    /**
     * @param array{added: list<array<string, mixed>>, removed: list<array<string, mixed>>, changed: list<array<string, mixed>>} $trips
     * @return list<array<string, mixed>>
     */
    private function groupByRoute(array $trips): array
    {
        $groups = [];
        foreach (['added', 'removed', 'changed'] as $bucket) {
            foreach ($trips[$bucket] as $trip) {
                $routeId = (string) ($trip['route_id'] ?? '');
                $groups[$routeId] ??= ['route_id' => $routeId, 'trips_added' => [], 'trips_removed' => [], 'trips_changed' => []];
                $groups[$routeId]['trips_' . $bucket][] = $trip['trip_id'];
            }
        }
        ksort($groups, SORT_STRING);
        return array_values($groups);
    }

    /** @return array<string, mixed> */
    private function versionSummary(DatasetVersion $version): array
    {
        return [
            'id' => $version->id,
            'version_number' => $version->version_number,
            'label' => $version->label,
            'status' => $version->status,
        ];
    }
}
