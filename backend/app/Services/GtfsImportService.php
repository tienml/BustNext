<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Gtfs\Parser\GtfsZipImporter;
use App\Domain\Gtfs\Parser\SafeZipExtractor;
use App\Domain\Gtfs\Time\GtfsTime;
use App\Domain\Gtfs\Validator\ValidationError;
use App\Models\DatasetVersion;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

/**
 * Imports a validated GTFS ZIP into one immutable dataset version.
 *
 * Parsing and validation happen before the database transaction. This keeps a
 * bad feed isolated: only the new version is marked failed, and the active
 * version remains untouched. All external GTFS identifiers are scoped by the
 * version through dataset_version_id.
 */
final class GtfsImportService
{
    public function __construct(
        private readonly GtfsZipImporter $parser,
        private readonly SafeZipExtractor $extractor,
    ) {
    }

    /** @return array{status: string, version: DatasetVersion, errors: list<array<string, mixed>>, warnings: list<array<string, mixed>>} */
    public function import(DatasetVersion $version, string $zipPath): array
    {
        $version->update(['status' => 'validating']);
        $workspace = storage_path('app/gtfs-import/' . $version->id . '-' . bin2hex(random_bytes(6)));
        $errors = [];
        $warnings = [];

        try {
            $this->extractor->extract($zipPath, $workspace);
            $feedDirectory = $this->locateFeedDirectory($workspace);
            $parsed = $this->parser->parseDirectory($feedDirectory);
            $errors = $parsed['errors'];
            $warnings = $parsed['warnings'];

            if ($errors !== []) {
                $this->markFailed($version, $errors, $warnings, $parsed['stats']);
                return $this->result($version->fresh(), $errors, $warnings);
            }

            DB::transaction(function () use ($version, $parsed, $warnings): void {
                $this->persistRows($version, $parsed['rows']);
                $version->update([
                    'status' => 'ready',
                    'stats' => $parsed['stats'],
                    'error_count' => 0,
                    'warning_count' => count($warnings),
                    'imported_at' => now(),
                ]);
            });

            return $this->result($version->fresh(), [], $warnings);
        } catch (Throwable $exception) {
            $errors[] = new ValidationError(
                'feed.zip',
                0,
                null,
                'import_failed',
                $exception->getMessage(),
            );
            $this->markFailed($version, $errors, $warnings, []);
            return $this->result($version->fresh(), $errors, $warnings);
        } finally {
            $this->removeDirectory($workspace);
        }
    }

    /** @param array<string, list<array<string, string>>> $rows */
    private function persistRows(DatasetVersion $version, array $rows): void
    {
        $versionId = (int) $version->id;
        $now = now();
        $agencyMap = [];

        foreach ($rows['agency.txt'] ?? [] as $row) {
            $id = DB::table('agencies')->insertGetId([
                'dataset_version_id' => $versionId,
                'agency_id' => $this->required($row, 'agency_id', 'agency.txt'),
                'name' => $this->required($row, 'agency_name', 'agency.txt'),
                'timezone' => $this->required($row, 'agency_timezone', 'agency.txt'),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $agencyMap[$row['agency_id']] = $id;
        }

        $defaultAgencyId = count($agencyMap) === 1 ? array_values($agencyMap)[0] : null;
        $routeMap = [];
        foreach ($rows['routes.txt'] ?? [] as $row) {
            $externalRouteId = $this->required($row, 'route_id', 'routes.txt');
            $agencyExternalId = trim($row['agency_id'] ?? '');
            $routeMap[$externalRouteId] = true;
            DB::table('routes')->insert([
                'dataset_version_id' => $versionId,
                'route_id' => $externalRouteId,
                'agency_id' => $agencyMap[$agencyExternalId] ?? $defaultAgencyId,
                'short_name' => $this->nullable($row['route_short_name'] ?? null),
                'long_name' => $this->nullable($row['route_long_name'] ?? null),
                'route_type' => (int) ($row['route_type'] ?? 3),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ($rows['stops.txt'] ?? [] as $row) {
            DB::table('stops')->insert([
                'dataset_version_id' => $versionId,
                'stop_id' => $this->required($row, 'stop_id', 'stops.txt'),
                'code' => $this->nullable($row['stop_code'] ?? null),
                'name' => $this->required($row, 'stop_name', 'stops.txt'),
                'lat' => (float) $this->required($row, 'stop_lat', 'stops.txt'),
                'lon' => (float) $this->required($row, 'stop_lon', 'stops.txt'),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ($rows['calendar.txt'] ?? [] as $row) {
            DB::table('calendar_services')->insert([
                'dataset_version_id' => $versionId,
                'service_id' => $this->required($row, 'service_id', 'calendar.txt'),
                'start_date' => $this->gtfsDate($this->required($row, 'start_date', 'calendar.txt')),
                'end_date' => $this->gtfsDate($this->required($row, 'end_date', 'calendar.txt')),
                'monday' => $this->flag($row['monday'] ?? '0'),
                'tuesday' => $this->flag($row['tuesday'] ?? '0'),
                'wednesday' => $this->flag($row['wednesday'] ?? '0'),
                'thursday' => $this->flag($row['thursday'] ?? '0'),
                'friday' => $this->flag($row['friday'] ?? '0'),
                'saturday' => $this->flag($row['saturday'] ?? '0'),
                'sunday' => $this->flag($row['sunday'] ?? '0'),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ($rows['calendar_dates.txt'] ?? [] as $row) {
            DB::table('calendar_dates')->insert([
                'dataset_version_id' => $versionId,
                'service_id' => $this->required($row, 'service_id', 'calendar_dates.txt'),
                'date' => $this->gtfsDate($this->required($row, 'date', 'calendar_dates.txt')),
                'exception_type' => (int) $this->required($row, 'exception_type', 'calendar_dates.txt'),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ($rows['trips.txt'] ?? [] as $row) {
            DB::table('trips')->insert([
                'dataset_version_id' => $versionId,
                'trip_id' => $this->required($row, 'trip_id', 'trips.txt'),
                'route_id' => $this->required($row, 'route_id', 'trips.txt'),
                'service_id' => $this->required($row, 'service_id', 'trips.txt'),
                'headsign' => $this->nullable($row['trip_headsign'] ?? null),
                'direction_id' => $this->nullableInt($row['direction_id'] ?? null),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ($rows['stop_times.txt'] ?? [] as $row) {
            $arrival = GtfsTime::parse($this->required($row, 'arrival_time', 'stop_times.txt'));
            $departure = GtfsTime::parse($this->required($row, 'departure_time', 'stop_times.txt'));
            DB::table('stop_times')->insert([
                'dataset_version_id' => $versionId,
                'trip_id' => $this->required($row, 'trip_id', 'stop_times.txt'),
                'stop_id' => $this->required($row, 'stop_id', 'stop_times.txt'),
                'arrival_seconds' => $arrival->seconds,
                'departure_seconds' => $departure->seconds,
                'arrival_raw' => $arrival->raw,
                'departure_raw' => $departure->raw,
                'stop_sequence' => (int) $this->required($row, 'stop_sequence', 'stop_times.txt'),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /** @param list<ValidationError> $errors @param list<ValidationError> $warnings @param array<string, int> $stats */
    private function markFailed(DatasetVersion $version, array $errors, array $warnings, array $stats): void
    {
        DB::transaction(function () use ($version, $errors, $warnings, $stats): void {
            $version->update([
                'status' => 'failed',
                'stats' => $stats,
                'error_count' => count($errors),
                'warning_count' => count($warnings),
            ]);
            foreach (array_merge($errors, $warnings) as $error) {
                $version->validationErrors()->create($error->toArray());
            }
        });
    }

    /** @param list<ValidationError> $errors @param list<ValidationError> $warnings */
    private function result(DatasetVersion $version, array $errors, array $warnings): array
    {
        return [
            'status' => $version->status,
            'version' => $version,
            'errors' => array_map(static fn (ValidationError $error): array => $error->toArray(), $errors),
            'warnings' => array_map(static fn (ValidationError $error): array => $error->toArray(), $warnings),
        ];
    }

    private function locateFeedDirectory(string $workspace): string
    {
        if (is_file($workspace . DIRECTORY_SEPARATOR . 'agency.txt')) {
            return $workspace;
        }

        $directories = array_values(array_filter(glob($workspace . DIRECTORY_SEPARATOR . '*') ?: [], 'is_dir'));
        if (count($directories) === 1 && is_file($directories[0] . DIRECTORY_SEPARATOR . 'agency.txt')) {
            return $directories[0];
        }

        return $workspace;
    }

    private function required(array $row, string $key, string $file): string
    {
        $value = trim((string) ($row[$key] ?? ''));
        if ($value === '') {
            throw new RuntimeException("Missing {$key} in {$file}");
        }
        return $value;
    }

    private function nullable(?string $value): ?string
    {
        $value = $value === null ? null : trim($value);
        return $value === '' ? null : $value;
    }

    private function nullableInt(?string $value): ?int
    {
        $value = $this->nullable($value);
        return $value === null ? null : (int) $value;
    }

    private function flag(string $value): bool
    {
        return trim($value) === '1';
    }

    private function gtfsDate(string $value): string
    {
        return substr($value, 0, 4) . '-' . substr($value, 4, 2) . '-' . substr($value, 6, 2);
    }

    private function removeDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }
        foreach (array_diff(scandir($directory) ?: [], ['.', '..']) as $entry) {
            $path = $directory . DIRECTORY_SEPARATOR . $entry;
            is_dir($path) ? $this->removeDirectory($path) : @unlink($path);
        }
        @rmdir($directory);
    }
}
