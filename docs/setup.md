# Thiết lập môi trường

## Phân chia máy

- **Máy backend:** WSL2, Docker Engine trong WSL, PHP 8.3+, Composer 2+, Git, PostgreSQL client tùy chọn và các PHP extension `pdo_pgsql`, `mbstring`, `xml`, `zip`, `curl`, `redis`.
- **Máy frontend:** Node.js 20+, npm, Expo/React Native toolchain. Máy frontend không cần cài PHP, Composer hoặc Docker nếu chỉ gọi API từ máy backend.
- Backend và frontend có thể ở hai máy khác nhau. Frontend phải truy cập được IP LAN của máy backend qua cổng `8000`.

## Backend trên WSL2

Trong terminal Ubuntu/WSL:

```bash
cd /mnt/d/BusNext
sudo service docker start
docker compose up -d postgres redis

cd backend
composer install
cp .env.example .env       # chỉ chạy một lần
php artisan key:generate   # chỉ chạy một lần
php artisan migrate:fresh --seed
php artisan test
php artisan serve --host=0.0.0.0 --port=8000
```

Cấu hình backend thống nhất:

```env
DB_CONNECTION=pgsql
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=busnext
DB_USERNAME=busnext
DB_PASSWORD=busnext
REDIS_HOST=localhost
REDIS_PORT=6379
```

`migrate:fresh` xóa dữ liệu database hiện tại; khi chỉ muốn chạy migration mới, dùng `php artisan migrate --seed`.

Kiểm tra API:

```bash
curl http://localhost:8000/api/health
```

## Frontend trên máy thành viên

```bash
cd mobile
npm install
npm run typecheck
npx expo start
```

Tạo biến môi trường trên máy frontend, không commit secret:

```env
# Frontend chạy trên Android Emulator cùng máy backend
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api

# Frontend chạy trên máy khác: thay bằng IP LAN của máy backend
# EXPO_PUBLIC_API_URL=http://192.168.x.x:8000/api
```

Nếu frontend ở máy khác, backend phải chạy với `--host=0.0.0.0`, hai máy cùng mạng và Windows firewall phải mở TCP 8000 cho mạng riêng.

## Kiểm thử backend

Integration test cần PostgreSQL thật từ Docker Compose:

```bash
cd /mnt/d/BusNext
bash scripts/check-wsl.sh
cd backend
php artisan test
```

## Luồng demo

1. Khởi động PostgreSQL/PostGIS và Redis trên máy backend.
2. Chạy Laravel API trên máy backend.
3. Seed dataset demo `hanoi-bus` hoặc upload ZIP GTFS qua API.
4. Thành viên frontend cấu hình `EXPO_PUBLIC_API_URL` và chạy Expo trên máy của họ.
5. Frontend gọi API tìm trạm, tuyến và chuyến; dữ liệu GTFS vẫn được quản lý tại backend.
