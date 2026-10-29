<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\DatasetVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * CSV downloads for operators: a version's schedule and its import error report.
 *
 * Files start with a UTF-8 BOM so Excel shows Vietnamese names correctly, and
 * rows are streamed in chunks so large feeds don't load into memory.
 */
final class ExportController
{
    /**
     * Issues a download link valid for 10 minutes. The browser that opens it
     * carries no token, so the signature is what authorises the download.
     */
    public function link(Request $request, DatasetVersion $version, string $kind): JsonResponse
    {
        $validated = $request->validate(['route_id' => ['nullable', 'string', 'max:120']]);
        $params = ['version' => $version->id];
        if ($kind === 'schedule' && ($validated['route_id'] ?? '') !== '') {
            $params['route_id'] = $validated['route_id'];
        }
        $expires = now()->addMinutes(10);

        return response()->json(['data' => [
            'path' => URL::temporarySignedRoute("export.{$kind}", $expires, $params, absolute: false),
            'expires_at' => $expires->toIso8601String(),
        ]]);
    }

    public function schedule(Request $request, DatasetVersion $version): StreamedResponse
    {
        $validated = $request->validate([
            'route_id' => ['nullable', 'string', 'max:120'],
            'service_id' => ['nullable', 'string', 'max:120'],
        ]);

        $query = DB::table('stop_times as st')
            ->join('trips as t', function ($join): void {
                $join->on('t.dataset_version_id', '=', 'st.dataset_version_id')->on('t.trip_id', '=', 'st.trip_id');
            })
            ->leftJoin('routes as r', function ($join): void {
                $join->on('r.dataset_version_id', '=', 't.dataset_version_id')->on('r.route_id', '=', 't.route_id');
            })
            ->leftJoin('stops as s', function ($join): void {
                $join->on('s.dataset_version_id', '=', 'st.dataset_version_id')->on('s.stop_id', '=', 'st.stop_id');
            })
            ->where('st.dataset_version_id', $version->id)
            ->when($validated['route_id'] ?? null, fn ($q, $routeId) => $q->where('t.route_id', $routeId))
            ->when($validated['service_id'] ?? null, fn ($q, $serviceId) => $q->where('t.service_id', $serviceId))
            ->orderBy('t.route_id')->orderBy('st.trip_id')->orderBy('st.stop_sequence')
            ->select([
                't.route_id', 'r.short_name', 't.trip_id', 't.service_id', 't.headsign', 't.direction_id',
                'st.stop_sequence', 'st.stop_id', 's.name as stop_name', 'st.arrival_raw', 'st.departure_raw',
            ]);

        $suffix = isset($validated['route_id']) ? '-route-' . $this->slug($validated['route_id']) : '';

        return $this->csv(
            "schedule-v{$version->version_number}{$suffix}.csv",
            ['route_id', 'route_short_name', 'trip_id', 'service_id', 'trip_headsign', 'direction_id',
                'stop_sequence', 'stop_id', 'stop_name', 'arrival_time', 'departure_time'],
            $query,
            static fn (object $row): array => [
                $row->route_id, $row->short_name, $row->trip_id, $row->service_id, $row->headsign, $row->direction_id,
                $row->stop_sequence, $row->stop_id, $row->stop_name, $row->arrival_raw, $row->departure_raw,
            ],
        );
    }

    public function validation(DatasetVersion $version): StreamedResponse
    {
        $query = DB::table('validation_errors')
            ->where('dataset_version_id', $version->id)
            ->orderBy('severity')->orderBy('file_name')->orderBy('row_number')
            ->select(['id', 'severity', 'code', 'file_name', 'row_number', 'column_name', 'value', 'message']);

        return $this->csv(
            "validation-v{$version->version_number}.csv",
            ['severity', 'code', 'file_name', 'row_number', 'column_name', 'value', 'message'],
            $query,
            static fn (object $row): array => [
                $row->severity, $row->code, $row->file_name, $row->row_number, $row->column_name, $row->value, $row->message,
            ],
        );
    }

    /**
     * @param list<string> $header
     * @param callable(object): list<mixed> $map
     */
    private function csv(string $filename, array $header, \Illuminate\Database\Query\Builder $query, callable $map): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $query, $map): void {
            $out = fopen('php://output', 'wb');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $header, escape: '');
            foreach ($query->lazy(1000) as $row) {
                fputcsv($out, array_map($this->cell(...), $map($row)), escape: '');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Neutralise spreadsheet formulas in user-supplied values (CSV injection). */
    private function cell(mixed $value): string
    {
        $value = (string) ($value ?? '');
        return $value !== '' && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true) && !is_numeric($value)
            ? "'" . $value
            : $value;
    }

    private function slug(string $value): string
    {
        return preg_replace('/[^A-Za-z0-9_-]+/', '_', $value) ?? 'route';
    }
}
