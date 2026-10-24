# BusNext

Ứng dụng tra cứu và quản lý lịch giao thông công cộng theo GTFS tĩnh.

## Stack

- Backend: PHP 8.3, Laravel 11, PostgreSQL 16, REST JSON.
- Mobile: React Native + Expo + TypeScript.
- GTFS: `agency.txt`, `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt`.

## Trạng thái

Backend đã chạy được end-to-end trên WSL2 + Docker (PostgreSQL 16 + PostGIS, Redis 7):

- Schema GTFS với version isolation, `stop_times` lưu giây nguyên để giữ được `25:10:00`.
- API tra cứu trạm gần (haversine), giờ xe kế tiếp (kể cả chuyến vượt nửa đêm), tuyến, chuyến, tìm kiếm gộp.
- 25 test pass trên PostgreSQL thật (`php artisan test`), gồm test cho ngoại lệ lịch, chuyến qua nửa đêm và import ZIP.
- Seed demo `hanoi-bus`: 3 tuyến, 6 trạm, 4 chuyến, có một chuyến `25:10:00` và một ngoại lệ lịch ngày 02/09.

Phần chưa làm: xử lý upload ZIP chạy nền (`GtfsZipImporter` mới là domain class chưa nối vào queue), so sánh version, realtime vehicle/incident/detour, và toàn bộ mobile app.

## Chạy backend (máy backend)

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

## Chạy mobile (máy thành viên frontend)

Thành viên frontend mới cần cài Node.js 20+, npm, Expo/React Native toolchain và chạy:

```bash
cd mobile
npm install
npx expo start
```

Họ đặt `EXPO_PUBLIC_API_URL` trỏ tới backend. Nếu chạy Android Emulator trên cùng máy backend, thường dùng `http://10.0.2.2:8000/api`; nếu frontend chạy trên máy khác, dùng địa chỉ IP LAN của máy backend, ví dụ `http://192.168.x.x:8000/api`. Hai máy phải cùng mạng và firewall phải cho phép cổng 8000.

## Nguyên tắc quan trọng

- Mỗi lần nhập là một snapshot version bất biến; import lỗi không thể làm đổi bản active.
- GTFS time được lưu thành giây kể từ đầu `service_date`, không dùng SQL `TIME`. `25:10:00` là `90600` giây và vẫn thuộc service date của feed.
- `calendar_dates.exception_type=1` thêm dịch vụ, `2` hủy dịch vụ.
- API luôn trả `service_date`, giờ GTFS gốc và giờ hiển thị địa phương.

Xem thêm [docs/setup.md](docs/setup.md), [docs/wsl-setup.md](docs/wsl-setup.md), [docs/frontend-setup.md](docs/frontend-setup.md), [docs/gtfs-support.md](docs/gtfs-support.md) và [docs/api.md](docs/api.md).
