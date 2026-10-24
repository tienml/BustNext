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

`shapes.txt`, `frequencies.txt`, `transfers.txt`, fare files và GTFS-Realtime. ZIP chứa các file này phải tạo warning rõ ràng, không âm thầm coi là đã hỗ trợ.
