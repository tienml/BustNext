# Phạm vi GTFS

## Bắt buộc

| File | Mục đích |
| --- | --- |
| `agency.txt` | Nhà cung cấp dịch vụ |
| `stops.txt` | Trạm |
| `routes.txt` | Tuyến |
| `trips.txt` | Chuyến và service |
| `stop_times.txt` | Lần dừng và giờ |
| `calendar.txt` | Lịch theo thứ/khoảng ngày |
| `calendar_dates.txt` | Ngày thêm/hủy |

## Quy tắc thời gian

Parser chấp nhận `HH:MM` hoặc `HH:MM:SS`, cho phép giờ từ `00` đến `47` trong MVP. Phút và giây phải từ `00` đến `59`. Ví dụ `25:10:00` được chuẩn hóa thành `90600` giây, giữ raw value để audit và hiển thị.

`service_date` là ngày vận hành, không phải ngày lịch sau khi cộng phần giờ vượt 24. Một chuyến `25:10:00` của service date `2026-10-21` chạy vào rạng sáng ngày lịch `2026-10-22` nhưng vẫn mang service date `2026-10-21`.

## Chưa hỗ trợ trong MVP

`shapes.txt`, `frequencies.txt`, `transfers.txt`, fare files và GTFS-Realtime. ZIP chứa các file này phải tạo warning rõ ràng, không âm thầm coi là đã hỗ trợ. Successful imports retain warnings in `validation_errors` for the paginated validation API; warning-only imports are still `ready` and can be activated.

## Agency identifiers

A single agency may omit `agency_id`; routes without an agency ID resolve to that sole agency. An explicit unknown route agency ID is always an error, including in single-agency feeds. Multiple agencies require unique, nonempty agency IDs and explicit matching IDs on every route. Missing/unknown references are reported before database persistence.

## Fixture provenance and reproducibility

The checked-in `fixtures/gtfs/dataset-a-v1`, `dataset-a-v2` and `dataset-b-v1` are **synthetic test fixtures**, not verified operator feeds. Their presence does not establish a public source URL, publisher permission, real-world timetable accuracy, or a data license. No external acquisition or provenance verification was performed in this implementation. Operator feeds and evidence of their permitted use remain separate delivery work.

Static CSV inspection on 2026-11-12 found:

| Folder | Routes | Stops | Trips | Stop times |
| --- | ---: | ---: | ---: | ---: |
| `dataset-a-v1` | 5 | 40 | 100 | 300 |
| `dataset-a-v2` | 5 | 40 | 101 | 303 |
| `dataset-b-v1` | 5 | 40 | 100 | 300 |

All three contain `calendar_dates.txt` and an arrival at `25:10:00` (departure `25:11:00`). A-v1/A-v2 use Monday–Saturday service: `2026-10-31` removes a normally active Saturday; `2026-11-01` adds a normally inactive Sunday. Sunday `2026-10-25` supplies the inactive baseline. B-v1 remains daily, so its add exception is redundant; meaningful-add acceptance coverage deliberately uses A-v1/A-v2. A-v2 removes T100, adds T101/T102, and changes T050's stop times; the saved-query scenario checks the resulting departure change at S20.

The CSV counts and meaningful-add baseline were checked without a database. Direct `GtfsZipImporter::parseDirectory` calls on A-v1/A-v2 returned respectively `errors=0 warnings=0 routes=5 stops=40 trips=100` and `errors=0 warnings=0 routes=5 stops=40 trips=101`. PHP 8.3 syntax checks on all 13 changed/new backend PHP files reported no syntax errors. On 2026-11-12 the complete backend suite passed under PHP 8.3.36 / PHPUnit 11.5.57: **68 tests, 606 assertions**. It ran against a separate PostgreSQL container on loopback port 55439, database `busnext_requirements_test`, without the application environment file or production database. Coverage includes import/activation/lookup, added and removed service exceptions, previous-service-day departures, agency validation, persisted warnings, combined trip filters, scoped/global lookup parity, version comparison and saved-query reruns after activation. Native mobile upload/download and the two manual end-to-end scenarios have not yet been exercised on a device.
