<?php

declare(strict_types=1);

namespace App\Services;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;

final class JourneyPlanner
{
    /** Minimum time to walk between platforms at a transfer stop. */
    private const MIN_TRANSFER_SECONDS = 300;

    /** Longer waits (e.g. overnight) are not offered as a transfer. */
    private const MAX_TRANSFER_WAIT_SECONDS = 7200;

    public function __construct(private readonly ActiveServiceIds $activeServices)
    {
    }

    /**
     * Plan direct journeys and journeys with at most one transfer from static GTFS.
     * Route geometry and walking legs are intentionally outside this service until
     * the dataset contains shapes and a walking provider is configured.
     *
     * The planner keeps service dates separate from trip IDs. A GTFS trip can be
     * present on both the previous and requested service date, and times such as
     * 25:10:00 must be compared as absolute instants rather than clock values.
     *
     * @return list<array<string, mixed>>
     */
    public function plan(
        int $versionId,
        string $originStopId,
        string $destinationStopId,
        string $date,
        string $time,
        int $maxTransfers = 1,
        int $limit = 5,
    ): array {
        $absoluteNow = $this->serviceDateTimestamp($date) + $this->toSeconds($time);
        $serviceDates = [
            (new DateTimeImmutable($date))->modify('-1 day')->format('Y-m-d'),
            $date,
        ];

        /** @var array<string, array{trip: object, service_date: string, stops: list<array<string, mixed>>}> $instances */
        $instances = [];
        $tripIds = [];

        foreach ($serviceDates as $serviceDate) {
            $serviceIds = $this->activeServices->forDate($versionId, $serviceDate);
            if ($serviceIds === []) {
                continue;
            }

            $tripRows = DB::table('trips as t')
                ->join('routes as r', function ($join): void {
                    $join->on('r.dataset_version_id', '=', 't.dataset_version_id')
                        ->on('r.route_id', '=', 't.route_id');
                })
                ->leftJoin('agencies as a', 'a.id', '=', 'r.agency_id')
                ->where('t.dataset_version_id', $versionId)
                ->whereIn('t.service_id', $serviceIds)
                ->get([
                    't.trip_id', 't.route_id', 't.headsign', 't.direction_id',
                    'r.short_name', 'r.long_name', 'a.name as agency_name',
                ]);

            foreach ($tripRows as $trip) {
                $instanceKey = $serviceDate . '|' . $trip->trip_id;
                $instances[$instanceKey] = [
                    'trip' => $trip,
                    'service_date' => $serviceDate,
                    'stops' => [],
                ];
                $tripIds[$trip->trip_id] = true;
            }
        }

        if ($instances === []) {
            return [];
        }

        $stopTimeRows = DB::table('stop_times as st')
            ->leftJoin('stops as s', function ($join): void {
                $join->on('s.dataset_version_id', '=', 'st.dataset_version_id')
                    ->on('s.stop_id', '=', 'st.stop_id');
            })
            ->where('st.dataset_version_id', $versionId)
            ->whereIn('st.trip_id', array_keys($tripIds))
            ->orderBy('st.trip_id')
            ->orderBy('st.stop_sequence')
            ->get([
                'st.trip_id', 'st.stop_id', 'st.stop_sequence',
                'st.arrival_seconds', 'st.departure_seconds',
                'st.arrival_raw', 'st.departure_raw',
                's.code as stop_code', 's.name as stop_name',
                's.lat', 's.lon',
            ]);

        $stopsByTrip = [];
        foreach ($stopTimeRows as $row) {
            $stopsByTrip[$row->trip_id][] = $this->stopRow($row);
        }

        /** @var array<string, list<array<string, mixed>>> $eventsByStop */
        $eventsByStop = [];
        foreach ($instances as $instanceKey => &$instance) {
            $serviceTimestamp = $this->serviceDateTimestamp($instance['service_date']);
            foreach ($stopsByTrip[$instance['trip']->trip_id] ?? [] as $stop) {
                $stop['service_date'] = $instance['service_date'];
                $stop['absolute_arrival'] = $serviceTimestamp + $stop['arrival_seconds'];
                $stop['absolute_departure'] = $serviceTimestamp + $stop['departure_seconds'];
                $instance['stops'][] = $stop;
                $eventsByStop[$stop['stop_id']][] = [
                    'trip_key' => $instanceKey,
                    'stop_sequence' => $stop['stop_sequence'],
                    'arrival_seconds' => $stop['arrival_seconds'],
                    'departure_seconds' => $stop['departure_seconds'],
                    'absolute_arrival' => $stop['absolute_arrival'],
                    'absolute_departure' => $stop['absolute_departure'],
                ];
            }
        }
        unset($instance);

        foreach ($eventsByStop as &$events) {
            usort($events, static fn (array $a, array $b): int => $a['absolute_departure'] <=> $b['absolute_departure']);
        }
        unset($events);

        $journeys = [];
        foreach ($instances as $instanceKey => $instance) {
            $trip = $instance['trip'];
            $stops = $instance['stops'];
            $origin = $this->findStop($stops, $originStopId);
            $destination = $this->findStop($stops, $destinationStopId);

            if ($origin !== null && $destination !== null
                && $origin['stop_sequence'] < $destination['stop_sequence']
                && $origin['absolute_departure'] >= $absoluteNow
            ) {
                $journeys[] = $this->directJourney($trip, $origin, $destination);
            }

            if ($maxTransfers < 1 || $origin === null || $origin['absolute_departure'] < $absoluteNow) {
                continue;
            }

            foreach ($stops as $transfer) {
                if ($transfer['stop_sequence'] <= $origin['stop_sequence']) {
                    continue;
                }

                $minimumDeparture = $transfer['absolute_arrival'] + self::MIN_TRANSFER_SECONDS;
                $maximumDeparture = $transfer['absolute_arrival'] + self::MAX_TRANSFER_WAIT_SECONDS;
                foreach ($eventsByStop[$transfer['stop_id']] ?? [] as $secondEvent) {
                    if ($secondEvent['absolute_departure'] > $maximumDeparture) {
                        break;
                    }
                    if ($secondEvent['trip_key'] === $instanceKey || $secondEvent['absolute_departure'] < $minimumDeparture) {
                        continue;
                    }

                    $secondInstance = $instances[$secondEvent['trip_key']] ?? null;
                    if ($secondInstance === null) {
                        continue;
                    }

                    $secondTrip = $secondInstance['trip'];
                    if ($secondTrip->route_id === $trip->route_id) {
                        continue;
                    }

                    $secondTransfer = $this->findStop($secondInstance['stops'], $transfer['stop_id']);
                    $secondDestination = $this->findStop($secondInstance['stops'], $destinationStopId);
                    if ($secondTransfer === null || $secondDestination === null
                        || $secondTransfer['stop_sequence'] >= $secondDestination['stop_sequence']
                    ) {
                        continue;
                    }

                    $journeys[] = $this->transferJourney(
                        $trip,
                        $origin,
                        $transfer,
                        $secondTrip,
                        $secondTransfer,
                        $secondDestination,
                    );
                    break;
                }
            }
        }

        usort($journeys, static function (array $a, array $b): int {
            return [$a['arrival_absolute'], $a['transfers'], $a['departure_absolute']]
                <=> [$b['arrival_absolute'], $b['transfers'], $b['departure_absolute']];
        });

        $unique = [];
        foreach ($journeys as $journey) {
            $key = implode(':', [
                $journey['service_date'],
                ...array_map(static fn (array $leg): string => $leg['service_date'] . '|' . $leg['trip_id'], $journey['legs']),
            ]);
            $unique[$key] ??= $journey;
        }

        return array_map(
            fn (array $journey): array => $this->publicJourney($journey),
            array_slice(array_values($unique), 0, max(1, min($limit, 20))),
        );
    }

    /** @return array<string, mixed> */
    private function directJourney(object $trip, array $origin, array $destination): array
    {
        return [
            'type' => 'direct',
            'transfers' => 0,
            'service_date' => $origin['service_date'],
            'departure_seconds' => $origin['departure_seconds'],
            'arrival_seconds' => $destination['arrival_seconds'],
            'departure_time' => $origin['departure_time'],
            'arrival_time' => $destination['arrival_time'],
            'departure_absolute' => $origin['absolute_departure'],
            'arrival_absolute' => $destination['absolute_arrival'],
            'duration_minutes' => max(0, (int) round(($destination['absolute_arrival'] - $origin['absolute_departure']) / 60)),
            'legs' => [$this->leg($trip, $origin, $destination)],
        ];
    }

    /** @return array<string, mixed> */
    private function transferJourney(object $firstTrip, array $origin, array $transfer, object $secondTrip, array $secondTransfer, array $destination): array
    {
        return [
            'type' => 'one_transfer',
            'transfers' => 1,
            'service_date' => $origin['service_date'],
            'departure_seconds' => $origin['departure_seconds'],
            'arrival_seconds' => $destination['arrival_seconds'],
            'departure_time' => $origin['departure_time'],
            'arrival_time' => $destination['arrival_time'],
            'departure_absolute' => $origin['absolute_departure'],
            'arrival_absolute' => $destination['absolute_arrival'],
            'duration_minutes' => max(0, (int) round(($destination['absolute_arrival'] - $origin['absolute_departure']) / 60)),
            'legs' => [
                $this->leg($firstTrip, $origin, $transfer),
                $this->leg($secondTrip, $secondTransfer, $destination),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function leg(object $trip, array $from, array $to): array
    {
        return [
            'trip_id' => $trip->trip_id,
            'route_id' => $trip->route_id,
            'route_short_name' => $trip->short_name,
            'route_long_name' => $trip->long_name,
            'agency_name' => $trip->agency_name,
            'headsign' => $trip->headsign,
            'service_date' => $from['service_date'],
            'from' => $this->publicStop($from),
            'to' => $this->publicStop($to),
        ];
    }

    /** @return array<string, mixed> */
    private function publicJourney(array $journey): array
    {
        unset($journey['departure_absolute'], $journey['arrival_absolute']);
        return $journey;
    }

    /** @return array<string, mixed> */
    private function publicStop(array $stop): array
    {
        return [
            'stop_id' => $stop['stop_id'],
            'stop_code' => $stop['stop_code'],
            'stop_name' => $stop['stop_name'],
            'lat' => $stop['lat'],
            'lon' => $stop['lon'],
            'stop_sequence' => $stop['stop_sequence'],
            'arrival_seconds' => $stop['arrival_seconds'],
            'departure_seconds' => $stop['departure_seconds'],
            'arrival_time' => $stop['arrival_time'],
            'departure_time' => $stop['departure_time'],
            'service_date' => $stop['service_date'],
        ];
    }

    /** @return array<string, mixed> */
    private function stopRow(object $row): array
    {
        return [
            'stop_id' => $row->stop_id,
            'stop_code' => $row->stop_code,
            'stop_name' => $row->stop_name,
            'lat' => $row->lat,
            'lon' => $row->lon,
            'stop_sequence' => (int) $row->stop_sequence,
            'arrival_seconds' => (int) $row->arrival_seconds,
            'departure_seconds' => (int) $row->departure_seconds,
            'arrival_time' => $row->arrival_raw,
            'departure_time' => $row->departure_raw,
        ];
    }

    /** @param list<array<string, mixed>> $stops */
    private function findStop(array $stops, string $stopId): ?array
    {
        foreach ($stops as $stop) {
            if ($stop['stop_id'] === $stopId) {
                return $stop;
            }
        }
        return null;
    }

    private function serviceDateTimestamp(string $date): int
    {
        return (new DateTimeImmutable($date . ' 00:00:00', new DateTimeZone('Asia/Ho_Chi_Minh')))->getTimestamp();
    }

    private function toSeconds(string $time): int
    {
        [$hours, $minutes, $seconds] = array_map('intval', explode(':', $time));
        return $hours * 3600 + $minutes * 60 + $seconds;
    }
}
