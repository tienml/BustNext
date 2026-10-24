<?php

declare(strict_types=1);

namespace App\Domain\Gtfs\Time;

use InvalidArgumentException;

final readonly class GtfsTime
{
    public function __construct(
        public int $seconds,
        public string $raw,
    ) {
    }

    public static function parse(string $value, int $maxHour = 47): self
    {
        $raw = trim($value);
        if (!preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/', $raw, $matches)) {
            throw new InvalidArgumentException("Invalid GTFS time: {$value}");
        }

        $hour = (int) $matches[1];
        $minute = (int) $matches[2];
        $second = isset($matches[3]) ? (int) $matches[3] : 0;
        if ($minute > 59 || $second > 59 || $hour > $maxHour) {
            throw new InvalidArgumentException("GTFS time is outside the supported range: {$value}");
        }

        return new self(($hour * 3600) + ($minute * 60) + $second, $raw);
    }

    public function display(bool $preserveOverflow = false): string
    {
        $hours = intdiv($this->seconds, 3600);
        if (!$preserveOverflow) {
            $hours %= 24;
        }

        return sprintf('%02d:%02d:%02d', $hours, intdiv($this->seconds % 3600, 60), $this->seconds % 60);
    }

    public function localDisplay(): string
    {
        $dayOffset = intdiv($this->seconds, 86400);
        $clock = $this->seconds % 86400;
        $display = sprintf('%02d:%02d:%02d', intdiv($clock, 3600), intdiv($clock % 3600, 60), $clock % 60);

        return $dayOffset > 0 ? "{$display} (+{$dayOffset} ngày)" : $display;
    }
}
