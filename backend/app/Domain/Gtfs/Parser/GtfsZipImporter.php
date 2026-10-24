<?php

declare(strict_types=1);

namespace App\Domain\Gtfs\Parser;

use App\Domain\Gtfs\CsvReader\CsvReader;
use App\Domain\Gtfs\Time\GtfsTime;
use App\Domain\Gtfs\Validator\ValidationError;
use DateTimeImmutable;
use RuntimeException;
use Throwable;

/**
 * Parses and validates one extracted GTFS feed.
 *
 * Persistence is deliberately kept out of this class: an import that fails
 * validation must never touch the snapshot users are currently reading. The
 * result is a plain array of rows plus the validation errors and warnings the
 * admin sees, which the caller either persists (no errors) or records as a
 * failed version (errors present).
 *
 * Files outside the MVP scope (shapes, frequencies, transfers, fares) produce
 * explicit warnings instead of being silently accepted as supported.
 */
final class GtfsZipImporter
{
    /** @var list<string> */
    private const REQUIRED_FILES = ['agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'];

    /** @var array<string, list<string>> Required columns per supported file. */
    private const REQUIRED_COLUMNS = [
        'agency.txt' => ['agency_name', 'agency_url', 'agency_timezone'],
        'stops.txt' => ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'],
        'routes.txt' => ['route_id', 'route_type'],
        'trips.txt' => ['route_id', 'service_id', 'trip_id'],
        'stop_times.txt' => ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
        'calendar.txt' => ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
        'calendar_dates.txt' => ['service_id', 'date', 'exception_type'],
    ];

    /** @var list<string> Files recognised by GTFS but not used by the MVP. */
    private const UNSUPPORTED_FILES = ['shapes.txt', 'frequencies.txt', 'transfers.txt', 'fare_attributes.txt', 'fare_rules.txt', 'feed_info.txt'];

    private const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    /** GTFS stop locations are WGS-84. */
    private const MAX_LATITUDE = 90.0;
    private const MAX_LONGITUDE = 180.0;

    /**
     * @return array{rows: array<string, list<array<string, string>>>, errors: list<ValidationError>, warnings: list<ValidationError>, stats: array<string, int>}
     */
    public function parseDirectory(string $directory): array
    {
        $errors = [];
        $warnings = [];
        $rows = [];
        $stats = [];

        $files = array_values(array_filter(
            scandir($directory) ?: [],
            static fn (string $file): bool => str_ends_with(strtolower($file), '.txt'),
        ));

        foreach (self::REQUIRED_FILES as $file) {
            if (!in_array($file, $files, true)) {
                $errors[] = new ValidationError($file, 0, null, 'missing_file', "Required GTFS file '{$file}' is missing");
            }
        }

        if (!in_array('calendar.txt', $files, true) && !in_array('calendar_dates.txt', $files, true)) {
            $errors[] = new ValidationError(
                'calendar.txt',
                0,
                null,
                'missing_service_calendar',
                'At least one of calendar.txt or calendar_dates.txt is required',
            );
        }

        foreach ($files as $file) {
            if (in_array($file, self::UNSUPPORTED_FILES, true)) {
                $warnings[] = new ValidationError($file, 0, null, 'unsupported_file', 'File is not used by the MVP', 'warning');
            }
        }

        if ($errors !== []) {
            return compact('rows', 'errors', 'warnings', 'stats');
        }

        foreach ($files as $file) {
            if (!isset(self::REQUIRED_COLUMNS[$file])) {
                // Optional/unknown file: still parse it so a malformed CSV is reported,
                // but it contributes no rows to persistence.
                continue;
            }

            try {
                $rows[$file] = $this->parseFile($directory . DIRECTORY_SEPARATOR . $file, $file, $errors);
                $stats[$file] = count($rows[$file]);
            } catch (RuntimeException $exception) {
                $errors[] = new ValidationError($file, 0, null, 'invalid_csv', $exception->getMessage());
            }
        }

        $this->validateRows($rows, $errors, $warnings);
        $this->validateReferences($rows, $errors);

        return compact('rows', 'errors', 'warnings', 'stats');
    }

    /**
     * Read one file, checking the header and every row's shape.
     *
     * @param list<ValidationError> $errors
     * @return list<array<string, string>>
     */
    private function parseFile(string $path, string $file, array &$errors): array
    {
        $required = self::REQUIRED_COLUMNS[$file];
        $parsed = [];
        $headerChecked = false;
        $line = 1;

        foreach ((new CsvReader())->rows($path) as $row) {
            $line++;

            if (!$headerChecked) {
                $missing = array_values(array_diff($required, array_keys($row)));
                foreach ($missing as $column) {
                    $errors[] = new ValidationError($file, 0, $column, 'missing_column', "Required column '{$column}' is missing from {$file}");
                }
                $headerChecked = true;
                if ($missing !== []) {
                    return [];
                }
            }

            $parsed[] = $row;
        }

        if (!$headerChecked) {
            $errors[] = new ValidationError($file, 0, null, 'empty_file', "GTFS file '{$file}' is empty");
        }

        return $parsed;
    }

    /**
     * Per-row checks: presence of required values and value formats.
     *
     * @param array<string, list<array<string, string>>> $rows
     * @param list<ValidationError> $errors
     * @param list<ValidationError> $warnings
     */
    private function validateRows(array $rows, array &$errors, array &$warnings): void
    {
        foreach ($rows['agency.txt'] ?? [] as $index => $row) {
            $line = $index + 2;

            foreach (self::REQUIRED_COLUMNS['agency.txt'] as $column) {
                $this->requireValue($row, 'agency.txt', $line, $column, $errors);
            }

            $timezone = trim($row['agency_timezone'] ?? '');
            if ($timezone !== '' && !in_array($timezone, timezone_identifiers_list(), true)) {
                $errors[] = new ValidationError('agency.txt', $line, 'agency_timezone', 'invalid_timezone', "Unknown timezone '{$timezone}'", 'error', $timezone);
            }

            $url = trim($row['agency_url'] ?? '');
            if ($url !== '' && filter_var($url, FILTER_VALIDATE_URL) === false) {
                $errors[] = new ValidationError('agency.txt', $line, 'agency_url', 'invalid_url', 'agency_url is not a valid URL', 'error', $url);
            }
        }

        foreach ($rows['stops.txt'] ?? [] as $index => $row) {
            $line = $index + 2;

            foreach (self::REQUIRED_COLUMNS['stops.txt'] as $column) {
                $this->requireValue($row, 'stops.txt', $line, $column, $errors);
            }

            $this->checkCoordinate($row, 'stops.txt', $line, 'stop_lat', self::MAX_LATITUDE, $errors);
            $this->checkCoordinate($row, 'stops.txt', $line, 'stop_lon', self::MAX_LONGITUDE, $errors);
        }

        foreach ($rows['routes.txt'] ?? [] as $index => $row) {
            $line = $index + 2;

            foreach (self::REQUIRED_COLUMNS['routes.txt'] as $column) {
                $this->requireValue($row, 'routes.txt', $line, $column, $errors);
            }

            $routeType = trim($row['route_type'] ?? '');
            if ($routeType !== '' && (!ctype_digit($routeType) || (int) $routeType > 12)) {
                $errors[] = new ValidationError('routes.txt', $line, 'route_type', 'invalid_route_type', 'route_type must be an integer between 0 and 12', 'error', $routeType);
            }

            if (trim($row['route_short_name'] ?? '') === '' && trim($row['route_long_name'] ?? '') === '') {
                $errors[] = new ValidationError('routes.txt', $line, 'route_short_name', 'missing_route_name', 'A route needs a short or long name', 'error', null);
            }
        }

        foreach ($rows['trips.txt'] ?? [] as $index => $row) {
            $line = $index + 2;

            foreach (self::REQUIRED_COLUMNS['trips.txt'] as $column) {
                $this->requireValue($row, 'trips.txt', $line, $column, $errors);
            }

            $direction = trim($row['direction_id'] ?? '');
            if ($direction !== '' && !in_array($direction, ['0', '1'], true)) {
                $errors[] = new ValidationError('trips.txt', $line, 'direction_id', 'invalid_direction', 'direction_id must be 0 or 1', 'error', $direction);
            }
        }

        foreach ($rows['stop_times.txt'] ?? [] as $index => $row) {
            $line = $index + 2;

            foreach (self::REQUIRED_COLUMNS['stop_times.txt'] as $column) {
                $this->requireValue($row, 'stop_times.txt', $line, $column, $errors);
            }

            foreach (['arrival_time', 'departure_time'] as $column) {
                $value = trim($row[$column] ?? '');
                if ($value === '') {
                    continue;
                }

                try {
                    GtfsTime::parse($value);
                } catch (Throwable $exception) {
                    $errors[] = new ValidationError('stop_times.txt', $line, $column, 'invalid_time', $exception->getMessage(), 'error', $value);
                }
            }

            $sequence = trim($row['stop_sequence'] ?? '');
            if ($sequence !== '' && !ctype_digit($sequence)) {
                $errors[] = new ValidationError('stop_times.txt', $line, 'stop_sequence', 'invalid_sequence', 'stop_sequence must be a non-negative integer', 'error', $sequence);
            }
        }

        foreach ($rows['calendar.txt'] ?? [] as $index => $row) {
            $line = $index + 2;

            foreach (self::REQUIRED_COLUMNS['calendar.txt'] as $column) {
                $this->requireValue($row, 'calendar.txt', $line, $column, $errors);
            }

            foreach (self::WEEKDAYS as $day) {
                $value = trim($row[$day] ?? '');
                if ($value !== '' && !in_array($value, ['0', '1'], true)) {
                    $errors[] = new ValidationError('calendar.txt', $line, $day, 'invalid_weekday_flag', "{$day} must be 0 or 1", 'error', $value);
                }
            }

            $start = $this->checkGtfsDate($row, 'calendar.txt', $line, 'start_date', $errors);
            $end = $this->checkGtfsDate($row, 'calendar.txt', $line, 'end_date', $errors);
            if ($start !== null && $end !== null && $end < $start) {
                $errors[] = new ValidationError('calendar.txt', $line, 'end_date', 'invalid_date_range', 'end_date is before start_date', 'error', $end->format('Ymd'));
            }

            if ($start !== null && $end !== null && $start === $end && !$this->hasAnyWeekday($row)) {
                $warnings[] = new ValidationError('calendar.txt', $line, null, 'service_never_runs', 'Service has no active weekday; it can only run via calendar_dates.txt', 'warning');
            }
        }

        foreach ($rows['calendar_dates.txt'] ?? [] as $index => $row) {
            $line = $index + 2;

            foreach (self::REQUIRED_COLUMNS['calendar_dates.txt'] as $column) {
                $this->requireValue($row, 'calendar_dates.txt', $line, $column, $errors);
            }

            $this->checkGtfsDate($row, 'calendar_dates.txt', $line, 'date', $errors);

            $exceptionType = trim($row['exception_type'] ?? '');
            if ($exceptionType !== '' && !in_array($exceptionType, ['1', '2'], true)) {
                $errors[] = new ValidationError('calendar_dates.txt', $line, 'exception_type', 'invalid_exception_type', 'exception_type must be 1 (added) or 2 (removed)', 'error', $exceptionType);
            }
        }
    }

    /**
     * Cross-file reference checks. An import whose trips point at stops that do
     * not exist would leave users with departures they can never board, so these
     * are hard errors rather than warnings.
     *
     * @param array<string, list<array<string, string>>> $rows
     * @param list<ValidationError> $errors
     */
    private function validateReferences(array $rows, array &$errors): void
    {
        $agencies = $this->column($rows['agency.txt'] ?? [], 'agency_id');
        $routes = $this->column($rows['routes.txt'] ?? [], 'route_id');
        $stops = $this->column($rows['stops.txt'] ?? [], 'stop_id');
        $trips = $this->column($rows['trips.txt'] ?? [], 'trip_id');
        $services = $this->column($rows['calendar.txt'] ?? [], 'service_id')
            + $this->column($rows['calendar_dates.txt'] ?? [], 'service_id');

        $this->checkDuplicates($rows['stops.txt'] ?? [], 'stops.txt', 'stop_id', $errors);
        $this->checkDuplicates($rows['routes.txt'] ?? [], 'routes.txt', 'route_id', $errors);
        $this->checkDuplicates($rows['trips.txt'] ?? [], 'trips.txt', 'trip_id', $errors);
        $this->checkDuplicates($rows['calendar.txt'] ?? [], 'calendar.txt', 'service_id', $errors);
        $this->checkDuplicates($rows['calendar_dates.txt'] ?? [], 'calendar_dates.txt', 'service_id', $errors, 'date');
        $this->checkDuplicates($rows['stop_times.txt'] ?? [], 'stop_times.txt', 'trip_id', $errors, 'stop_sequence');

        // agency_id is optional in GTFS when the feed has exactly one agency.
        $agencyOptional = count($agencies) <= 1;

        foreach ($rows['routes.txt'] ?? [] as $index => $route) {
            $agencyId = trim($route['agency_id'] ?? '');
            if (!$agencyOptional && $agencyId !== '' && !isset($agencies[$agencyId])) {
                $errors[] = new ValidationError('routes.txt', $index + 2, 'agency_id', 'unknown_agency', 'Route references an unknown agency', 'error', $agencyId);
            }
        }

        foreach ($rows['trips.txt'] ?? [] as $index => $trip) {
            $routeId = trim($trip['route_id'] ?? '');
            if ($routeId !== '' && !isset($routes[$routeId])) {
                $errors[] = new ValidationError('trips.txt', $index + 2, 'route_id', 'unknown_route', 'Trip references an unknown route', 'error', $routeId);
            }

            $serviceId = trim($trip['service_id'] ?? '');
            if ($serviceId !== '' && !isset($services[$serviceId])) {
                $errors[] = new ValidationError('trips.txt', $index + 2, 'service_id', 'unknown_service', 'Trip references an unknown service', 'error', $serviceId);
            }
        }

        foreach ($rows['stop_times.txt'] ?? [] as $index => $stopTime) {
            $tripId = trim($stopTime['trip_id'] ?? '');
            if ($tripId !== '' && !isset($trips[$tripId])) {
                $errors[] = new ValidationError('stop_times.txt', $index + 2, 'trip_id', 'unknown_trip', 'Stop time references an unknown trip', 'error', $tripId);
            }

            $stopId = trim($stopTime['stop_id'] ?? '');
            if ($stopId !== '' && !isset($stops[$stopId])) {
                $errors[] = new ValidationError('stop_times.txt', $index + 2, 'stop_id', 'unknown_stop', 'Stop time references an unknown stop', 'error', $stopId);
            }
        }
    }

    /**
     * @param list<array<string, string>> $rows
     * @param list<ValidationError> $errors
     * @param list<string> $keyColumns
     */
    private function checkDuplicates(array $rows, string $file, string $keyColumn, array &$errors, ?string $secondKeyColumn = null): void
    {
        $seen = [];

        foreach ($rows as $index => $row) {
            $key = trim($row[$keyColumn] ?? '');
            if ($secondKeyColumn !== null) {
                $key .= "\x1F" . trim($row[$secondKeyColumn] ?? '');
            }

            if ($key === '' || isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
        }

        $duplicates = [];
        $counts = [];
        foreach ($rows as $row) {
            $key = trim($row[$keyColumn] ?? '');
            if ($secondKeyColumn !== null) {
                $key .= "\x1F" . trim($row[$secondKeyColumn] ?? '');
            }
            if ($key !== "\x1F" && $key !== '') {
                $counts[$key] = ($counts[$key] ?? 0) + 1;
            }
        }
        foreach ($counts as $key => $count) {
            if ($count > 1) {
                $duplicates[$key] = true;
            }
        }

        foreach ($rows as $index => $row) {
            $raw = trim($row[$keyColumn] ?? '');
            $key = $secondKeyColumn !== null ? $raw . "\x1F" . trim($row[$secondKeyColumn] ?? '') : $raw;

            if (isset($duplicates[$key])) {
                $message = $secondKeyColumn !== null
                    ? "Duplicate '{$keyColumn}' + '{$secondKeyColumn}' combination"
                    : "Duplicate '{$keyColumn}'";
                $errors[] = new ValidationError($file, $index + 2, $keyColumn, 'duplicate_key', $message, 'error', str_replace("\x1F", '/', $key));
                unset($duplicates[$key]);
            }
        }
    }

    /**
     * @param list<array<string, string>> $rows
     * @return array<string, true>
     */
    private function column(array $rows, string $column): array
    {
        $values = [];
        foreach ($rows as $row) {
            $value = trim($row[$column] ?? '');
            if ($value !== '') {
                $values[$value] = true;
            }
        }

        return $values;
    }

    /** @param array<string, string> $row @param list<ValidationError> $errors */
    private function requireValue(array $row, string $file, int $line, string $column, array &$errors): void
    {
        if (trim($row[$column] ?? '') === '') {
            $errors[] = new ValidationError($file, $line, $column, 'required', "Required column '{$column}' is empty", 'error', $row[$column] ?? null);
        }
    }

    /** @param array<string, string> $row @param list<ValidationError> $errors */
    private function checkCoordinate(array $row, string $file, int $line, string $column, float $limit, array &$errors): void
    {
        $value = trim($row[$column] ?? '');
        if ($value === '') {
            return;
        }

        if (!is_numeric($value)) {
            $errors[] = new ValidationError($file, $line, $column, 'invalid_coordinate', "{$column} must be numeric", 'error', $value);
            return;
        }

        $number = (float) $value;
        if (abs($number) > $limit) {
            $errors[] = new ValidationError($file, $line, $column, 'coordinate_out_of_range', "{$column} is outside the valid range", 'error', $value);
        }
    }

    /** @param array<string, string> $row @param list<ValidationError> $errors */
    private function checkGtfsDate(array $row, string $file, int $line, string $column, array &$errors): ?DateTimeImmutable
    {
        $value = trim($row[$column] ?? '');
        if ($value === '') {
            return null;
        }

        $date = DateTimeImmutable::createFromFormat('!Ymd', $value);
        if (!$date instanceof DateTimeImmutable || $date->format('Ymd') !== $value) {
            $errors[] = new ValidationError($file, $line, $column, 'invalid_date', 'Expected a YYYYMMDD date', 'error', $value);
            return null;
        }

        return $date;
    }

    /** @param array<string, string> $row */
    private function hasAnyWeekday(array $row): bool
    {
        foreach (self::WEEKDAYS as $day) {
            if (trim($row[$day] ?? '') === '1') {
                return true;
            }
        }

        return false;
    }
}
