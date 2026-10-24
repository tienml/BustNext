<?php

declare(strict_types=1);

namespace App\Domain\Gtfs\Validator;

use App\Domain\Gtfs\Time\GtfsTime;
use DateTimeImmutable;
use DateTimeInterface;
use Throwable;

final class GtfsRowValidator
{
    /** @param array<string, string> $row */
    public function required(array $row, string $file, int $line, array $columns): array
    {
        $errors = [];
        foreach ($columns as $column) {
            if (!array_key_exists($column, $row) || trim($row[$column]) === '') {
                $errors[] = new ValidationError($file, $line, $column, 'required', "Required column '{$column}' is empty", 'error', $row[$column] ?? null);
            }
        }
        return $errors;
    }

    /** @return list<ValidationError> */
    public function time(string $value, string $file, int $line, string $column): array
    {
        try {
            GtfsTime::parse($value);
            return [];
        } catch (Throwable $exception) {
            return [new ValidationError($file, $line, $column, 'invalid_time', $exception->getMessage(), 'error', $value)];
        }
    }

    /** @return list<ValidationError> */
    public function date(string $value, string $file, int $line, string $column): array
    {
        $date = DateTimeImmutable::createFromFormat('!Ymd', $value);
        $valid = $date instanceof DateTimeInterface && $date->format('Ymd') === $value;
        return $valid ? [] : [new ValidationError($file, $line, $column, 'invalid_date', 'Expected YYYYMMDD', 'error', $value)];
    }
}
