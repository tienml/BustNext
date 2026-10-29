# BusNext

Ứng dụng tra cứu và quản lý lịch giao thông công cộng theo GTFS tĩnh.

## Stack

- Backend: PHP 8.3, Laravel 11, PostgreSQL 16, REST JSON.
- App kết nối API: React Native + Expo + TypeScript trong `mobile/`. `mobile/` là runtime frontend duy nhất của sản phẩm.
- GTFS: `agency.txt`, `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt`.

## Trạng thái

Backend được thiết kế để chạy end-to-end trên WSL2 + Docker (PostgreSQL 16 + PostGIS, Redis 7):

- Schema GTFS với version isolation, `stop_times` lưu giây nguyên để giữ được `25:10:00`.
- API tra cứu trạm gần (haversine), giờ xe kế tiếp (kể cả chuyến vượt nửa đêm), tuyến, chuyến, tìm kiếm gộp.
- Bộ test hiện có bao phủ ngoại lệ lịch, chuyến qua nửa đêm và import ZIP; test auth/favorites và lập tuyến đã được bổ sung trong phiên bản này.
- Seed demo `hanoi-bus`: 3 tuyến, 6 trạm, 4 chuyến, có một chuyến `25:10:00` và một ngoại lệ lịch ngày 02/09.
- Auth Sanctum, favorites server-backed và lập tuyến tĩnh trực tiếp/chuyển tuyến một lần đã có test; cần chạy trong môi trường PHP/Composer/PostgreSQL để xác nhận tích hợp.

### Tài khoản và dữ liệu cá nhân

Mobile hỗ trợ đăng ký, đăng nhập, đăng xuất và yêu thích trạm/tuyến qua Laravel Sanctum. Chạy `php artisan migrate` trong backend trước khi dùng. Realtime xe, traffic, vé điện tử và thanh toán vẫn cần các milestone backend/dịch vụ riêng; app không hiển thị chúng như dữ liệu thật khi chưa có nguồn hợp lệ.

Máy backend chỉ cần WSL2, Docker Engine trong WSL, PHP 8.3+, Composer 2+, Git và các PHP extension `pdo_pgsql`, `mbstring`, `xml`, `zip`, `curl`, `redis`. **Không cần Node.js, npm, Expo hoặc dependency trong `mobile/` trên máy này.**

Trong terminal Ubuntu/WSL:

```bash
cd /mnt/d/BusNext

# Mỗi lần mở WSL nếu Docker chưa chạy
sudo service docker start

docker compose up -d postgres redis
docker compose ps

cd backend
composer install
# Chỉ cần chạy một lần cho checkout mới:
cp .env.example .env
php artisan key:generate

# Tạo schema và dữ liệu demo; migrate:fresh sẽ xóa dữ liệu DB hiện tại
php artisan migrate:fresh --seed
php artisan test
php artisan serve --host=0.0.0.0 --port=8000
```

API backend: `http://localhost:8000/api`.

Docker Compose dùng PostgreSQL/PostGIS 16 và Redis 7 với database/user/password đều là `busnext`. Không chạy file SQL độc lập sau khi dùng Laravel migration; schema hiện hành được tạo bởi `php artisan migrate:fresh --seed`.

Để dừng backend nhưng giữ dữ liệu:

```bash
# Dừng server Laravel bằng Ctrl+C ở terminal đang serve
docker compose stop
```

Để xem log hoặc kiểm tra nhanh:

```bash
docker compose logs -f postgres
curl http://localhost:8000/api/health
```

## Chạy mobile kết nối API (máy thành viên frontend)

Đây là app chính đang gọi Laravel API:

```bash
cd mobile
npm install
npm run typecheck
npx expo start
```

Đặt `EXPO_PUBLIC_API_URL` trỏ tới backend theo hướng dẫn trong [docs/frontend-setup.md](docs/frontend-setup.md).

## Nguyên tắc quan trọng

- Mỗi lần nhập là một snapshot version bất biến; import lỗi không thể làm đổi bản active.
- GTFS time được lưu thành giây kể từ đầu `service_date`, không dùng SQL `TIME`. `25:10:00` là `90600` giây và vẫn thuộc service date của feed.
- `calendar_dates.exception_type=1` thêm dịch vụ, `2` hủy dịch vụ.
- API luôn trả `service_date`, giờ GTFS gốc và giờ hiển thị địa phương.

Xem thêm [docs/setup.md](docs/setup.md), [docs/wsl-setup.md](docs/wsl-setup.md), [docs/frontend-setup.md](docs/frontend-setup.md), [docs/gtfs-support.md](docs/gtfs-support.md) và [docs/api.md](docs/api.md).
