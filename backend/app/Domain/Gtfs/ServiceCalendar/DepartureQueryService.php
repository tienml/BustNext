<?php

declare(strict_types=1);

namespace App\Domain\Gtfs\ServiceCalendar;

use App\Domain\Gtfs\Time\GtfsTime;
use DateTimeImmutable;

final readonly class DepartureQueryService
{
    /**
     * Returns absolute epoch seconds for departures relevant to a local timestamp.
     * GTFS seconds are anchored to the service date, so a lookup at 01:10 on
     * calendar day D must compare 25:10:00 with service date D-1 as well as the
     * regular service date D.
     *
     * @param list<array{stop_id: string, trip_id: string, service_id: string, departure_time: string}> $stopTimes
     * @param list<ServiceCalendar> $calendars
     * @param list<CalendarDateException> $exceptions
     * @return list<array<string, int|string>>
     */
    public function nextDepartures(
        string $stopId,
        DateTimeImmutable $localDate,
        GtfsTime $after,
        int $limit,
        array $stopTimes,
        array $calendars,
        array $exceptions,
    ): array {
        $resolver = new ServiceDateResolver();
        $serviceDates = [$localDate->modify('-1 day'), $localDate];
        $serviceIdsByDate = [];
        foreach ($serviceDates as $serviceDate) {
            $serviceIdsByDate[$serviceDate->format('Y-m-d')] = [
                'date' => $serviceDate,
                'ids' => array_fill_keys(
                    $resolver->activeServiceIds($serviceDate, $calendars, $exceptions),
                    true,
                ),
            ];
        }

        $results = [];
        $queryAbsolute = $localDate->setTime(0, 0)->getTimestamp() + $after->seconds;
        foreach ($stopTimes as $stopTime) {
            if ($stopTime['stop_id'] !== $stopId) {
                continue;
            }
            foreach ($serviceIdsByDate as $serviceDate => $serviceContext) {
                if (!isset($serviceContext['ids'][$stopTime['service_id']])) {
                    continue;
                }
                $seconds = GtfsTime::parse($stopTime['departure_time'])->seconds;
                $absolute = $serviceContext['date']->setTime(0, 0)->getTimestamp() + $seconds;
                if ($absolute >= $queryAbsolute) {
                    $results[] = [
                        'trip_id' => $stopTime['trip_id'],
                        'service_date' => $serviceDate,
                        'raw_time' => $stopTime['departure_time'],
                        'seconds' => $seconds,
                        'absolute_timestamp' => $absolute,
                        'display_time' => GtfsTime::parse($stopTime['departure_time'])->localDisplay(),
                    ];
                }
            }
        }

        usort($results, static fn (array $a, array $b): int => $a['absolute_timestamp'] <=> $b['absolute_timestamp']);
        return array_slice($results, 0, $limit);
    }
}
