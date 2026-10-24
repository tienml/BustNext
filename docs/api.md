# API contract

Base URL: `/api`. All lookups answer from the **active** dataset version only; a newer import stays invisible until it is activated.

## Health

- `GET /health` — trạng thái dịch vụ và kết nối database.

## Datasets & versions

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/v1/datasets` | Danh sách dataset kèm active version |
| `GET` | `/v1/datasets/{dataset}/versions` | Danh sách snapshot của một dataset |
| `POST` | `/v1/datasets/{dataset}/versions` | Upload file ZIP (multipart `file`, tuỳ chọn `label`), trả 202 với version `pending` |
| `GET` | `/v1/versions/{version}/validation` | Lỗi validate theo file/dòng/cột |
| `POST` | `/v1/versions/{version}/activate` | Activate version `ready`; version cũ chuyển `archived` trong cùng transaction |

`{dataset}` và `{version}` bind theo `id`.

## Lookups

Hai dạng route cho cùng dữ liệu:

- **Theo dataset**: `/v1/datasets/{dataset}/stops`, `/stops/nearby`, `/stops/{stopId}`, `/stops/{stopId}/departures`, `/routes`, `/routes/{routeId}`, `/routes/{routeId}/trips`, `/trips/{tripId}`, `/trips/{tripId}/stop-times`.
- **Theo version active**: `/v1/gtfs/...` với cùng các path con.

| Method | Path | Query | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/gtfs/stops` | `q`, `limit` | Tìm trạm theo `stop_id`, `code`, `name` |
| `GET` | `/gtfs/stops/{stopId}` | — | Chi tiết một trạm |
| `GET` | `/gtfs/stops/nearby` | `lat`, `lon` (bắt buộc), `radius` (m, mặc định 1000), `limit` | Trạm trong bán kính, sắp theo khoảng cách (haversine) |
| `GET` | `/gtfs/stops/{stopId}/departures` | `date` `YYYY-MM-DD`, `time` `HH:MM:SS`, `limit` | Chuyến kế tiếp, gồm cả chuyến vượt nửa đêm |
| `GET` | `/gtfs/routes` | `q`, `route_type`, `limit` | Danh sách/tìm tuyến |
| `GET` | `/gtfs/routes/{routeId}` | — | Chi tiết tuyến + danh sách trạm + số chuyến |
| `GET` | `/gtfs/routes/{routeId}/trips` | `date` | Chuyến chạy trong ngày, sắp theo giờ xuất phát đầu |
| `GET` | `/gtfs/trips/{tripId}` | — | Chi tiết chuyến + toàn bộ stop_times |
| `GET` | `/gtfs/trips/{tripId}/stop-times` | — | Chỉ stop_times |
| `GET` | `/search` | `q` (bắt buộc), `limit` | Tìm cả trạm và tuyến, trả về nhóm `stops` / `routes` |

## Định dạng thời gian

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

`GET /versions/{from}/compare/{to}`, upload xử lý nền, realtime vehicle/incident/detour endpoints — nằm trong các milestone sau của kế hoạch.
