<?php

declare(strict_types=1);

namespace Tests\Unit\Gtfs;

use App\Domain\Gtfs\Time\GtfsTime;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class GtfsTimeTest extends TestCase
{
    public function test_it_parses_overflow_hours_without_changing_service_day(): void
    {
        $time = GtfsTime::parse('25:10:00');

        self::assertSame(90600, $time->seconds);
        self::assertSame('25:10:00', $time->display(true));
        self::assertSame('01:10:00 (+1 ngày)', $time->localDisplay());
    }

    public function test_it_accepts_minutes_without_seconds(): void
    {
        self::assertSame(23 * 3600 + 59 * 60, GtfsTime::parse('23:59')->seconds);
    }

    public function test_it_rejects_invalid_minutes_seconds_and_hour_limit(): void
    {
        foreach (['01:60:00', '01:00:60', '48:00:00', 'bad'] as $value) {
            $this->expectException(InvalidArgumentException::class);
            GtfsTime::parse($value);
        }
    }
}
