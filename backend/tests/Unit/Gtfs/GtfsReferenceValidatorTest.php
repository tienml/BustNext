<?php

declare(strict_types=1);

namespace Tests\Unit\Gtfs;

use App\Domain\Gtfs\Parser\GtfsZipImporter;
use PHPUnit\Framework\TestCase;

final class GtfsReferenceValidatorTest extends TestCase
{
    public function test_it_finds_unknown_stop_and_trip_references(): void
    {
        $directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'busnext-' . bin2hex(random_bytes(5));
        mkdir($directory);
        file_put_contents($directory . '/agency.txt', "agency_id,agency_name,agency_url,agency_timezone\na,Demo,https://example.test,Asia/Ho_Chi_Minh\n");
        file_put_contents($directory . '/routes.txt', "route_id,agency_id,route_short_name,route_long_name,route_type\nr1,a,1,One,3\n");
        file_put_contents($directory . '/stops.txt', "stop_id,stop_name,stop_lat,stop_lon\ns1,One,10,106\n");
        file_put_contents($directory . '/trips.txt', "route_id,service_id,trip_id\nr1,weekday,t1\n");
        file_put_contents($directory . '/stop_times.txt', "trip_id,arrival_time,departure_time,stop_id,stop_sequence\nmissing,25:10:00,25:10:00,s-missing,1\n");
        file_put_contents($directory . '/calendar.txt', "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nweekday,1,1,1,1,1,1,1,20260101,20261231\n");

        $result = (new GtfsZipImporter())->parseDirectory($directory);
        $codes = array_map(static fn ($error): string => $error->code, $result['errors']);

        self::assertContains('unknown_trip', $codes);
        self::assertContains('unknown_stop', $codes);
        array_map('unlink', glob($directory . '/*') ?: []);
        rmdir($directory);
    }
}
