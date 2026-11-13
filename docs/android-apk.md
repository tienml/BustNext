# Chuẩn bị và kiểm thử Android độc lập

## Trạng thái và phạm vi

Tài liệu này là quy trình cục bộ, không phải bằng chứng đã tạo APK. Kiểm tra TypeScript hoặc preflight thành công không chứng minh native build thành công. Chưa chạy upload, ký ứng dụng, triển khai backend hoặc EAS Build trong bước chuẩn bị này.

- `preview`: APK, phân phối nội bộ, dùng cài trực tiếp trên điện thoại.
- `production`: Android App Bundle (`.aab`), dùng cho cửa hàng; không phải APK cài trực tiếp.
- Không tự tạo UUID dự án Expo. `app.json` cần liên kết với dự án thật trước khi preflight có thể thành công.

## 1. Backend thật và HTTPS

Bản backend đang chạy hoặc mới nhất trong WSL có thể khác bản backend trong repository Windows. Xác định rõ đường dẫn bản WSL, commit hoặc thay đổi chưa commit, cấu hình triển khai và dữ liệu đang sử dụng. Không coi backend trong repository là bản mới nhất khi chưa đối chiếu; không chép đè hoặc đồng bộ dữ liệu tự động. Việc chuẩn bị mobile không thay đổi backend WSL hay cơ sở dữ liệu.

Cần triển khai bản backend đã xác nhận lên địa chỉ HTTPS công khai có chứng chỉ hợp lệ, hoạt động từ Internet/4G/5G. Kiểm tra endpoint, xác thực, múi giờ và dữ liệu GTFS thực tế. Điện thoại độc lập không dùng được `localhost` của máy phát triển. Không dùng IP LAN, địa chỉ WSL, `10.0.2.2`, HTTP hoặc ngoại lệ cleartext làm giải pháp phát hành. Không đưa tài khoản quản trị, mật khẩu, khóa riêng hoặc token vào app.

## 2. Biến môi trường và kiểm tra cục bộ

Chạy trong `C:\btlPTPM\BustNext\mobile` bằng PowerShell. Thay URL ví dụ bằng backend thật trước khi chạy.

```powershell
$env:EXPO_PUBLIC_API_URL = 'https://api.example.com/api'
npm run apk:check
npm run apk:check -- production
node scripts/apk-preflight.smoke.cjs
npm run typecheck
```

`EXPO_PUBLIC_*` là dữ liệu công khai được nhúng vào bundle, không phải kho bí mật. Giữ đúng tiền tố đường dẫn API mà ứng dụng/backend yêu cầu. Preflight yêu cầu URL đặt rõ trong môi trường của tiến trình; không đọc `.env`, không có URL fallback. Không nhận URL chứa username/password, query hoặc fragment. Không in giá trị cấu hình ra log.

Preflight chỉ đọc `app.json` và `eas.json`, kiểm tra tên/slug/version/package Android, UUID liên kết Expo, profile preview/production, loại artifact, distribution và development client. Có hỗ trợ profile kế thừa; chặn vòng lặp và ghi đè API trong profile khác URL đã kiểm tra. Nếu xuất hiện cấu hình Expo động, cần kiểm tra cấu hình đã resolve riêng; preflight tĩnh không phê duyệt cấu hình đó.

Đây là kiểm tra cú pháp/cấu hình, không thực hiện DNS hay gọi backend; tên miền có thể vẫn trỏ tới mạng riêng, chứng chỉ có thể hỏng, dịch vụ có thể chưa chạy. Cần xác nhận bằng kết nối thật ở bước kiểm thử. Không đưa URL hoặc thông tin nhạy cảm vào báo cáo công khai.

## 3. Liên kết dự án, đồng nhất môi trường build

Sau khi chủ dự án xác nhận cho phép thao tác với tài khoản Expo, đăng nhập EAS CLI và liên kết dự án Expo thật (`eas init` khi cần). Sao lưu thay đổi hiện có trước khi chấp nhận các thay đổi cấu hình của CLI. Không dùng UUID giả chỉ để vượt kiểm tra.

Đặt cùng `EXPO_PUBLIC_API_URL` trong môi trường EAS dùng bởi profile đã chọn. Xác nhận profile chọn môi trường nào trên EAS và mọi giá trị ghi đè phía máy chủ trước khi build; không giả định shell cục bộ tự truyền đầy đủ môi trường lên cloud. Preflight không truy cập EAS để đối chiếu biến từ xa. Sau build phải xác minh app thật gọi đúng backend; đổi biến trong shell sau build không thay đổi URL đã nhúng trong APK.

## 4. Kiểm tra gói mã nguồn và quyền đồng ý

Trước bất kỳ lệnh cloud build nào, cần chủ dự án đồng ý rõ ràng với:

1. Tài khoản/tổ chức Expo và dự án đích.
2. Việc tải mã nguồn cần thiết lên Expo EAS, dịch vụ và chi phí có thể phát sinh.
3. Phương án tạo/chọn khóa ký, nơi lưu khóa và người có quyền quản lý.

Lời đồng ý chuẩn bị mã nguồn không thay thế đồng ý upload hoặc quản lý khóa ký. Nếu chưa được đồng ý, dừng ở kiểm tra cục bộ, không chạy các lệnh build bên dưới.

Kiểm tra nội dung archive và quy tắc `.easignore`/`.gitignore` trước khi cho phép upload. Loại bỏ file bí mật không cần cho build, khóa riêng/keystore, dữ liệu GTFS/database dư thừa, export tạm, log, bản sao backend và artifact build cũ. Không chỉ dựa vào việc file đã bị Git ignore. Không thêm tài khoản admin hoặc token vào source để demo. Duyệt nội dung archive ở nơi riêng tư, không dán nội dung bí mật vào log/chat.

Không commit keystore, mật khẩu ký hoặc credentials vào Git. Chọn lưu credentials qua EAS hoặc cơ chế an toàn do chủ dự án quản lý; ghi lại bên sở hữu, quyền truy cập, sao lưu và quy trình khôi phục. Bản cập nhật cài đè cần cùng package và chữ ký tương thích; khi dùng Play App Signing phải phân biệt upload key và app signing key. Không tạo lại khóa tùy tiện để sửa lỗi build.

## 5. Build sau khi được đồng ý

```powershell
# APK nội bộ; preflight phải thành công trước khi gọi EAS CLI.
npm run build:android:preview

# AAB cho cửa hàng, không phải APK cài trực tiếp.
npm run build:android:production
```

Các script gọi `npx eas-cli`, có thể tải công cụ nếu máy chưa có. Chỉ thực hiện khi đã duyệt quyền truy cập mạng, cài công cụ, upload và ký. Nếu preflight thất bại, sửa cấu hình thật; không bỏ qua nó, không bật HTTP hay dùng UUID giả. Có thể dùng phiên bản EAS CLI đã được đội dự án kiểm chứng để tái lập build.

Sau build, tải artifact từ đúng tài khoản/dự án và ghi lại build ID, profile, phiên bản, package và nguồn mã đã dùng. Không tự submit lên cửa hàng chỉ vì build thành công.

## 6. Tiêu chí nghiệm thu trên điện thoại thật

- Tắt Metro/Expo Go; cài APK preview và mở độc lập, không crash.
- Dùng 4G/5G, không chỉ Wi-Fi cùng máy tính; xác nhận đúng HTTPS backend.
- Mất mạng, timeout và backend lỗi có thông báo và thử lại; không lộ token trong log.
- Đăng nhập, đăng xuất, khôi phục phiên và yêu thích đúng người dùng.
- GPS: cho phép/từ chối quyền, GPS tắt, timeout và vị trí thực.
- Tra cứu trạm/tuyến/chuyến, chi tiết lịch trình và dữ liệu thực tế.
- GTFS qua nửa đêm, giờ `25:10`, ngày thêm/hủy dịch vụ và múi giờ.
- Quản trị: upload, validation, activation, comparison, export; xác nhận phân quyền bằng backend. Chỉ thử thao tác thay đổi dữ liệu trên môi trường/dữ liệu đã được cho phép.
- Đưa app xuống nền, mở lại và khôi phục kết nối.
- Cài bản APK mới đè bản cũ bằng chữ ký tương thích, không cần gỡ app và không mất dữ liệu ngoài dự kiến.

Ghi kết quả thực tế, phiên bản Android/thiết bị, build ID và lỗi còn tồn tại. Chỉ gọi là APK sẵn sàng bàn giao sau khi có artifact ký thật và các mục nghiệm thu đã được kiểm chứng; không suy luận từ smoke test hoặc TypeScript.
