<?php

declare(strict_types=1);

namespace Tests\Unit\Gtfs;

use App\Domain\Gtfs\ServiceCalendar\CalendarDateException;
use App\Domain\Gtfs\ServiceCalendar\ServiceCalendar;
use App\Domain\Gtfs\ServiceCalendar\ServiceDateResolver;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class ServiceDateResolverTest extends TestCase
{
    public function test_exception_add_and_remove_override_regular_calendar(): void
    {
        $calendar = new ServiceCalendar('weekday', new DateTimeImmutable('2026-01-01'), new DateTimeImmutable('2026-12-31'), [
            'monday' => true, 'tuesday' => true, 'wednesday' => true, 'thursday' => true,
            'friday' => true, 'saturday' => false, 'sunday' => false,
        ]);
        $resolver = new ServiceDateResolver();

        self::assertSame([], $resolver->activeServiceIds(new DateTimeImmutable('2026-01-03'), [$calendar], []));
        self::assertSame(['weekday'], $resolver->activeServiceIds(new DateTimeImmutable('2026-01-03'), [$calendar], [
            new CalendarDateException('weekday', new DateTimeImmutable('2026-01-03'), 1),
        ]));
        self::assertSame([], $resolver->activeServiceIds(new DateTimeImmutable('2026-01-02'), [$calendar], [
            new CalendarDateException('weekday', new DateTimeImmutable('2026-01-02'), 2),
        ]));
    }
}
