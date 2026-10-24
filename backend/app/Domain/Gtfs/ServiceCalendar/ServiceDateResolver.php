<?php

declare(strict_types=1);

namespace App\Domain\Gtfs\ServiceCalendar;

use DateTimeImmutable;
use DateTimeInterface;

final readonly class CalendarDateException
{
    public function __construct(
        public string $serviceId,
        public DateTimeImmutable $date,
        public int $exceptionType,
    ) {
    }
}

final class ServiceDateResolver
{
    /**
     * @param list<ServiceCalendar> $calendars
     * @param list<CalendarDateException> $exceptions
     * @return list<string>
     */
    public function activeServiceIds(DateTimeInterface $date, array $calendars, array $exceptions): array
    {
        $day = DateTimeImmutable::createFromInterface($date)->setTime(0, 0);
        $active = [];

        foreach ($calendars as $calendar) {
            if ($calendar->runsOn($day)) {
                $active[$calendar->serviceId] = true;
            }
        }

        foreach ($exceptions as $exception) {
            if ($exception->date->format('Y-m-d') !== $day->format('Y-m-d')) {
                continue;
            }

            if ($exception->exceptionType === 1) {
                $active[$exception->serviceId] = true;
            } elseif ($exception->exceptionType === 2) {
                unset($active[$exception->serviceId]);
            }
        }

        return array_keys($active);
    }
}
