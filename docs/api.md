# API contract

Base URL: `/api`. All lookups answer from the **active** dataset version only; a newer import stays invisible until it is activated.

## Health

- `GET /health` — trạng thái dịch vụ và kết nối database.

## Datasets & versions

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/v1/datasets` | Danh sách dataset kèm active version |
| `GET` | `/v1/datasets/{dataset}/versions` | Danh sách snapshot của một dataset |
| `POST` | `/v1/datasets/{dataset}/versions` | Upload ZIP (multipart `file`, optional `label`): synchronous by default, 201 `ready` or 422 `failed`; `process=false` returns 202 `pending` without processing |
| `GET` | `/v1/versions/{version}/validation` | Lỗi validate theo file/dòng/cột |
| `POST` | `/v1/versions/{version}/activate` | Activate version `ready`; version cũ chuyển `archived` trong cùng transaction |

`{dataset}` và `{version}` bind theo `id`. Import, activation, validation review, comparison and saved queries require an authenticated admin account. A synchronous import returns `{status, version, errors, warnings}`. Validation review is paginated under `data.data`, including persisted warnings from successful imports. A failed import or rejected activation must not change the active pointer or its lookup results.

`GET /v1/versions/compare?base={id}&target={id}` returns `data.summary` (including `trips_added`, `trips_removed`, `trips_changed`) and detailed differences; comparison does not activate either snapshot.

## Lookups

Hai dạng route cho cùng dữ liệu:

- **Theo dataset**: `/v1/datasets/{dataset}/stops`, `/stops/nearby`, `/stops/{stopId}`, `/stops/{stopId}/departures`, `/routes`, `/routes/{routeId}`, `/routes/{routeId}/trips`, `/trips`, `/trips/{tripId}`, `/trips/{tripId}/stop-times`.
- **Theo version active**: `/v1/gtfs/...` với cùng các path con.

| Method | Path | Query | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/gtfs/stops` | `q`, `route_id`, `route_type`, `limit` (1–100, default 20) | Search by stop ID/code/name; optional route membership filters are combined |
| `GET` | `/gtfs/stops/{stopId}` | — | Chi tiết một trạm |
| `GET` | `/gtfs/stops/nearby` | `lat`, `lon` (bắt buộc), `radius` (m, mặc định 1000), `limit` | Trạm trong bán kính, sắp theo khoảng cách (haversine) |
| `GET` | `/gtfs/stops/{stopId}/departures` | `date` `YYYY-MM-DD`, `time` `HH:MM:SS`, `limit` | Chuyến kế tiếp, gồm cả chuyến vượt nửa đêm |
| `GET` | `/gtfs/routes` | `q`, `route_type`, `agency_id`, `limit` (1–200, default 100) | Search routes; `agency_id` is the external GTFS ID |
| `GET` | `/gtfs/routes/{routeId}` | — | Chi tiết tuyến + danh sách trạm + số chuyến |
| `GET` | `/gtfs/routes/{routeId}/trips` | `date`, `q`, `direction_id`, `limit` (1–200, optional) | Trips operating on date (default today), ordered by first departure; text matches trip ID/headsign |
| `GET` | `/gtfs/trips` | `q`, `route_id`, `route_type`, `direction_id`, `date`, `limit` (1–200, default 50) | Search active-snapshot trips by ID/headsign/route ID/route names; all filters combine; without date no service-day filter |
| `GET` | `/gtfs/trips/{tripId}` | — | Chi tiết chuyến + toàn bộ stop_times |
| `GET` | `/gtfs/trips/{tripId}/stop-times` | — | Chỉ stop_times |
| `GET` | `/search` | `q` (required), `limit` | Unified search grouped as `data.stops`, `data.routes`, `data.trips`; counts in `meta.counts` |
| `GET` | `/journeys/plan` | `from_stop_id`, `to_stop_id`, `date`, `time`, `max_transfers`, `limit` | Lập tuyến GTFS tĩnh trực tiếp hoặc tối đa một lần chuyển tuyến; kiểm tra cả service date trước đó cho chuyến sau nửa đêm |

Ví dụ lập tuyến:

```text
GET /api/v1/journeys/plan?from_stop_id=YN001&to_stop_id=NN001&date=2026-10-22&time=05:30:00&max_transfers=1&limit=5
```

Kết quả có `type` (`direct` hoặc `one_transfer`), `transfers`, thời gian GTFS, `duration_minutes` và các `legs`. Mỗi leg kèm `trip_id`, tuyến, trạm đầu/cuối và `service_date`. Đây là lập tuyến theo lịch tĩnh; chưa bao gồm đi bộ, hình học tuyến hoặc realtime.

## Authentication & account

Các endpoint tài khoản dùng Laravel Sanctum bearer token. Token phải gửi ở header `Authorization: Bearer <token>`.

| Method | Path | Auth | Mô tả |
| --- | --- | --- | --- |
| `POST` | `/v1/auth/register` | Không | Tạo tài khoản và trả token |
| `POST` | `/v1/auth/login` | Không | Đăng nhập và trả token |
| `POST` | `/v1/auth/logout` | Có | Thu hồi token hiện tại |
| `GET` | `/v1/auth/me` | Có | Thông tin tài khoản hiện tại |
| `GET` | `/v1/favorites` | Có | Danh sách trạm/tuyến yêu thích |
| `POST` | `/v1/favorites` | Có | Body `{ "type": "stop hoặc route", "entity_id": "..." }` |
| `DELETE` | `/v1/favorites/{favorite}` | Có | Xóa yêu thích thuộc tài khoản hiện tại |

Đăng ký yêu cầu `name`, `email`, `password`, `password_confirmation`; mật khẩu tối thiểu 8 ký tự. Không lưu bearer token trong AsyncStorage; app mobile dùng SecureStore.

GTFS time lưu thành **giây tính từ đầu service date**, không dùng SQL `TIME`. Một chuyến `25:10:00` là `90600` giây và vẫn thuộc service date mà nó khởi hành. Mỗi departure trả về cả hai dạng:

```json
{
  "trip_id": "TRIP_07_NIGHT",
  "route_short_name": "07",
  "headsign": "Bến xe Nước Ngầm",
  "service_date": "2026-10-21",
  "departure_time": "25:10:00",
  "departure_seconds": 90600,
  "absolute_timestamp": 1792631400,
  "minutes_until": 10
}
```

Khi tra cứu lúc 01:00 ngày 22/10, chuyến `25:10` của service date 21/10 xuất hiện với `minutes_until: 10` — không phải 1450. API luôn kiểm tra cả service date hiện tại và ngày trước đó, rồi so sánh trên cùng một mốc tuyệt đối.

## Lịch dịch vụ

`calendar_services` giữ pattern theo tuần; `calendar_dates` giữ ngoại lệ (`exception_type = 1` thêm, `2` bỏ). Một ngày hoạt động khi: nằm trong `start_date..end_date`, cờ thứ trong tuần bật, và không bị ngoại lệ loại bỏ — cộng thêm mọi service được ngoại lệ thêm vào.

## Lỗi

```json
{ "errors": [{ "code": "STOP_NOT_FOUND", "message": "Stop not found" }] }
```

- `404` — không có active version (`NO_ACTIVE_VERSION`), hoặc không tìm thấy trạm/tuyến/chuyến.
- `422` — activate version chưa `ready`, hoặc query không hợp lệ (validate của Laravel).

## Chưa triển khai

Queued upload processing and realtime vehicle/incident/detour endpoints are not implemented. The comparison endpoint above is implemented; the older `/versions/{from}/compare/{to}` path is not supported.

## Saved-query verification workflow

Create with `POST /v1/datasets/{dataset}/queries` and `{name, type, params}`; run one with `POST /v1/queries/{query}/run`, or all with `POST /v1/datasets/{dataset}/queries/run`. Queries resolve the currently active snapshot at run time, not at creation. A single run returns its outcome under `data` (`ok`, `status`, `version`, `data`, `errors`); list entries retain `last_version_id`, `last_status`, `last_result_count`. Supported types and parameter allowlists are validated by `SavedQueryController`; the new general trip-search endpoint is not automatically a saved-query type.

Feature coverage lives in `GtfsScenarioTest`, `SavedQueryTest`, `GtfsImportTest`, `GtfsAgencyAndWarningTest`, and `TripSearchTest`. These tests require an isolated PostgreSQL database: their setup deletes fixture tables. Do not run them against development or production data. Added assertions and source review alone are not evidence that the database suite passed; record the isolated runner's actual result separately.
