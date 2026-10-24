<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Minimal but realistic GTFS snapshot for a Hanoi-style network.
 *
 * Columns mirror the GTFS migration exactly: stops(name, code, lat, lon),
 * routes(short_name, long_name, route_type, agency_id -> agencies.id),
 * trips(headsign), stop_times(arrival_seconds, departure_seconds, *_raw).
 *
 * Includes one trip after midnight (25:10:00 = 90600s) so departure lookups
 * across the service-date boundary can be exercised in the demo.
 */
final class GtfsSampleSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            // This is deterministic demo data. Re-running the seeder replaces
            // only the sample dataset, never an operator-uploaded dataset.
            $existing = DB::table('datasets')->where('slug', 'hanoi-bus')->first();
            if ($existing !== null) {
                DB::table('datasets')->where('id', $existing->id)->delete();
            }

            $datasetId = DB::table('datasets')->insertGetId([
                'slug' => 'hanoi-bus',
                'name' => 'Hà Nội Bus System',
                'timezone' => 'Asia/Ho_Chi_Minh',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $versionId = DB::table('dataset_versions')->insertGetId([
                'dataset_id' => $datasetId,
                'version_number' => 1,
                'label' => 'Seed snapshot',
                'status' => 'active',
                'timezone' => 'Asia/Ho_Chi_Minh',
                'activated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('datasets')->where('id', $datasetId)->update(['active_version_id' => $versionId]);

            $agencyId = DB::table('agencies')->insertGetId([
                'dataset_version_id' => $versionId,
                'agency_id' => 'TRANSERCO',
                'name' => 'Transerco Hà Nội',
                'timezone' => 'Asia/Ho_Chi_Minh',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $routes = [
                ['01', '01', 'Bến xe Yên Nghĩa - Bến xe Gia Lâm'],
                ['07', '07', 'Kim Mã - Bến xe Nước Ngầm'],
                ['14', '14', 'Bến xe Mỹ Đình - Đại học Thăng Long'],
            ];
            foreach ($routes as [$routeId, $short, $long]) {
                DB::table('routes')->insert([
                    'dataset_version_id' => $versionId,
                    'route_id' => $routeId,
                    'agency_id' => $agencyId,
                    'short_name' => $short,
                    'long_name' => $long,
                    'route_type' => 3,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $stops = [
                ['YN001', 'BXYN', 'Bến xe Yên Nghĩa', 20.9562, 105.7461],
                ['GL001', 'BXGL', 'Bến xe Gia Lâm', 21.0436, 105.8973],
                ['KM001', 'KM', 'Kim Mã', 21.0285, 105.8242],
                ['NN001', 'BXNN', 'Bến xe Nước Ngầm', 20.9992, 105.8453],
                ['MD001', 'BXMD', 'Bến xe Mỹ Đình', 21.0278, 105.7789],
                ['DT001', 'DHTL', 'Đại học Thăng Long', 20.9955, 105.8420],
            ];
            foreach ($stops as [$stopId, $code, $name, $lat, $lon]) {
                DB::table('stops')->insert([
                    'dataset_version_id' => $versionId,
                    'stop_id' => $stopId,
                    'code' => $code,
                    'name' => $name,
                    'lat' => $lat,
                    'lon' => $lon,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('calendar_services')->insert([
                'dataset_version_id' => $versionId,
                'service_id' => 'WEEKDAY',
                'monday' => true, 'tuesday' => true, 'wednesday' => true,
                'thursday' => true, 'friday' => true, 'saturday' => false, 'sunday' => false,
                'start_date' => '2026-01-01',
                'end_date' => '2026-12-31',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 02/09 holiday: weekday service cancelled, holiday service added.
            DB::table('calendar_dates')->insert([
                ['dataset_version_id' => $versionId, 'service_id' => 'WEEKDAY', 'date' => '2026-09-02', 'exception_type' => 2, 'created_at' => now(), 'updated_at' => now()],
                ['dataset_version_id' => $versionId, 'service_id' => 'HOLIDAY', 'date' => '2026-09-02', 'exception_type' => 1, 'created_at' => now(), 'updated_at' => now()],
            ]);

            $trips = [
                ['TRIP_01_001', '01', 'WEEKDAY', 'Bến xe Gia Lâm', 0],
                ['TRIP_01_002', '01', 'WEEKDAY', 'Bến xe Gia Lâm', 0],
                ['TRIP_07_001', '07', 'WEEKDAY', 'Bến xe Nước Ngầm', 0],
                ['TRIP_07_NIGHT', '07', 'WEEKDAY', 'Bến xe Nước Ngầm', 1],
            ];
            foreach ($trips as [$tripId, $routeId, $serviceId, $headsign, $direction]) {
                DB::table('trips')->insert([
                    'dataset_version_id' => $versionId,
                    'trip_id' => $tripId,
                    'route_id' => $routeId,
                    'service_id' => $serviceId,
                    'headsign' => $headsign,
                    'direction_id' => $direction,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $this->insertStopTimes($versionId, 'TRIP_01_001', [
                ['YN001', 1, '06:00:00', '06:00:00'],
                ['KM001', 2, '06:40:00', '06:41:00'],
                ['GL001', 3, '07:20:00', '07:20:00'],
            ]);
            $this->insertStopTimes($versionId, 'TRIP_01_002', [
                ['YN001', 1, '17:00:00', '17:00:00'],
                ['KM001', 2, '17:40:00', '17:41:00'],
                ['GL001', 3, '18:20:00', '18:20:00'],
            ]);
            $this->insertStopTimes($versionId, 'TRIP_07_001', [
                ['KM001', 1, '08:00:00', '08:00:00'],
                ['NN001', 2, '08:30:00', '08:30:00'],
            ]);
            // Crosses midnight: departs 01:10 on the service date it started.
            $this->insertStopTimes($versionId, 'TRIP_07_NIGHT', [
                ['MD001', 1, '24:40:00', '24:40:00'],
                ['KM001', 2, '25:10:00', '25:10:00'],
                ['NN001', 3, '25:45:00', '25:45:00'],
            ]);
        });

        $this->command?->info('Seeded hanoi-bus dataset with 3 routes, 6 stops, 4 trips.');
    }

    /** @param list<array{0:string,1:int,2:string,3:string}> $rows */
    private function insertStopTimes(int $versionId, string $tripId, array $rows): void
    {
        foreach ($rows as [$stopId, $sequence, $arrival, $departure]) {
            DB::table('stop_times')->insert([
                'dataset_version_id' => $versionId,
                'trip_id' => $tripId,
                'stop_id' => $stopId,
                'stop_sequence' => $sequence,
                'arrival_seconds' => $this->toSeconds($arrival),
                'departure_seconds' => $this->toSeconds($departure),
                'arrival_raw' => $arrival,
                'departure_raw' => $departure,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function toSeconds(string $gtfsTime): int
    {
        $parts = explode(':', $gtfsTime);
        if (count($parts) !== 3) {
            throw new RuntimeException("Invalid GTFS time: {$gtfsTime}");
        }

        [$hours, $minutes, $seconds] = array_map('intval', $parts);
        return $hours * 3600 + $minutes * 60 + $seconds;
    }
}
