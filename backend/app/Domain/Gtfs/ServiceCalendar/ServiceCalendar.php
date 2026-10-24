<?php

declare(strict_types=1);

namespace App\Domain\Gtfs\ServiceCalendar;

use DateTimeImmutable;
use DateTimeInterface;

final readonly class ServiceCalendar
{
    /** @param array<string, bool> $weekdays */
    public function __construct(
        public string $serviceId,
        public DateTimeImmutable $startDate,
        public DateTimeImmutable $endDate,
        public array $weekdays,
    ) {
    }

    public function runsOn(DateTimeInterface $date): bool
    {
        $day = DateTimeImmutable::createFromInterface($date)->setTime(0, 0);
        if ($day < $this->startDate || $day > $this->endDate) {
            return false;
        }

        $weekday = strtolower($day->format('l'));
        return $this->weekdays[$weekday] ?? false;
    }
}
