# Chạy backend trên WSL2 (không dùng Docker Desktop)

Tài liệu chuẩn cho máy chạy Laravel backend của BusNext. App kết nối API nằm trong `mobile/`; frontend production dùng Expo và chạy trên máy thành viên frontend.

## Thành phần cần cài trên máy backend

- Windows 10/11 + WSL2 Ubuntu
- Docker Engine và Docker Compose plugin trong WSL
- PHP 8.3+
- Composer 2+
- Git
- PHP extensions: `pdo_pgsql`, `mbstring`, `xml`, `zip`, `curl`, `redis`
- Không cần Node.js, npm, Expo hoặc `mobile/node_modules`

## Cài Docker Engine trong WSL

Trong PowerShell Admin:

```powershell
wsl --install -d Ubuntu
wsl --set-default-version 2
```

Trong Ubuntu/WSL:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release git unzip
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
sudo service docker start
```

Thoát và mở lại Ubuntu sau `usermod` rồi kiểm tra:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

## PHP và Composer

Cài PHP 8.3+ cùng các extension theo nguồn package của môi trường. Kiểm tra:

```bash
php --version
composer --version
php -m | grep -E '^(PDO|pdo_pgsql|mbstring|xml|zip|curl|redis)$'
```

## Khởi động BusNext

```bash
cd /mnt/d/BusNext
sudo service docker start
docker compose up -d postgres redis
docker compose ps

cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan test
php artisan serve --host=0.0.0.0 --port=8000
```

Cấu hình database dùng thống nhất:

```env
DB_DATABASE=busnext
DB_USERNAME=busnext
DB_PASSWORD=busnext
REDIS_HOST=localhost
REDIS_PORT=6379
```

`migrate:fresh` xóa dữ liệu hiện tại. Khi không muốn xóa dữ liệu, dùng `php artisan migrate --seed`.

Kiểm tra API:

```bash
curl http://localhost:8000/api/health
```

## App kết nối API trên máy thành viên (`mobile/`)

Giữ source `mobile/` trong repository và chạy trên máy frontend:

```bash
cd mobile
npm install
npm run typecheck
npx expo start
```

Thiết lập `EXPO_PUBLIC_API_URL`:

- Android Emulator cùng máy backend: `http://10.0.2.2:8000/api`
- Máy frontend khác: `http://<IP-LAN-máy-backend>:8000/api`

Khi frontend ở máy khác, hai máy cần cùng mạng, backend phải dùng `--host=0.0.0.0`, và Windows Firewall phải cho phép TCP 8000 trong Private network. Không dùng `localhost` từ máy frontend khác.

## Lệnh hàng ngày

Terminal 1:

```bash
cd /mnt/d/BusNext
sudo service docker start
docker compose up -d postgres redis
```

Terminal 2:

```bash
cd /mnt/d/BusNext/backend
php artisan serve --host=0.0.0.0 --port=8000
```

Dừng server bằng `Ctrl+C`; dừng container mà không xóa volume:

```bash
cd /mnt/d/BusNext
docker compose stop
```
