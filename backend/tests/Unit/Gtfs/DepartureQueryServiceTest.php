<?php

declare(strict_types=1);

namespace Tests\Unit\Gtfs;

use App\Domain\Gtfs\ServiceCalendar\CalendarDateException;
use App\Domain\Gtfs\ServiceCalendar\DepartureQueryService;
use App\Domain\Gtfs\ServiceCalendar\ServiceCalendar;
use App\Domain\Gtfs\Time\GtfsTime;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class DepartureQueryServiceTest extends TestCase
{
    /**
     * A daily service running a 25:10 trip produces two upcoming departures at
     * 01:00 on 22/10: the one from service date 21/10 (at 01:10 today) and the
     * one from service date 22/10 (at 01:10 tomorrow). The earlier service date
     * must sort first, because that is the trip a rider can still catch.
     */
    public function test_it_returns_previous_service_date_for_after_midnight_overflow_trip(): void
    {
        $calendar = new ServiceCalendar('daily', new DateTimeImmutable('2026-10-01'), new DateTimeImmutable('2026-12-31'), array_fill_keys([
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
        ], true));

        $results = (new DepartureQueryService())->nextDepartures(
            'S01', new DateTimeImmutable('2026-10-22'), GtfsTime::parse('01:00:00'), 5,
            [['stop_id' => 'S01', 'trip_id' => 'T001', 'service_id' => 'daily', 'departure_time' => '25:10:00']],
            [$calendar],
            [],
        );

        self::assertCount(2, $results);
        self::assertSame('2026-10-21', $results[0]['service_date']);
        self::assertSame('25:10:00', $results[0]['raw_time']);
        self::assertSame('2026-10-22', $results[1]['service_date']);
        self::assertLessThan($results[1]['absolute_timestamp'], $results[0]['absolute_timestamp']);
    }

    /**
     * When the service only runs on a weekday, the previous calendar day is a
     * Sunday and contributes nothing, so only today's trip is returned.
     */
    public function test_it_excludes_previous_day_when_service_does_not_run(): void
    {
        $calendar = new ServiceCalendar('weekdays', new DateTimeImmutable('2026-10-01'), new DateTimeImmutable('2026-12-31'), [
            'monday' => true, 'tuesday' => true, 'wednesday' => true,
            'thursday' => true, 'friday' => true, 'saturday' => false, 'sunday' => false,
        ]);

        $results = (new DepartureQueryService())->nextDepartures(
            'S01', new DateTimeImmutable('2026-10-26'), GtfsTime::parse('01:00:00'), 5,
            [['stop_id' => 'S01', 'trip_id' => 'T001', 'service_id' => 'weekdays', 'departure_time' => '25:10:00']],
            [$calendar],
            [],
        );

        self::assertCount(1, $results);
        self::assertSame('2026-10-26', $results[0]['service_date']);
    }
}
