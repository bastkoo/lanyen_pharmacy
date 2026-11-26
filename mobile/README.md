# Lan Yến Pharmacy Mobile

Đăng nhập bằng JWT: số điện thoại → OTP 6 số → họ tên cho người mới.
Vai trò lấy từ Backend; shell sau đăng nhập chưa có nghiệp vụ trang chủ.

Đây là ứng dụng thật, đang phát triển trên máy Local. Theo yêu cầu hiện tại,
OTP được đọc trong terminal Backend; cách nhận OTP này không biến luồng JWT
hoặc tài khoản thành đăng nhập demo.

Trong VS Code mở thư mục repository, nhấn F5 và chọn
**Lan Yến Mobile · Chrome Local**. Cấu hình `.vscode/launch.json` cấp Base URL từ
`mobile/config/local.json` và dùng cổng giao diện cố định 5510.

```powershell
cd mobile
flutter pub get
flutter run -d chrome --web-hostname=127.0.0.1 --web-port=5510 --dart-define-from-file=config/local.json
```

Backend cần origin mới chỉ dành cho Mobile:
`MOBILE_AUTH_ALLOWED_ORIGINS=http://127.0.0.1:5510`.
API JWT mới dùng /api/mobile/auth; Website vẫn dùng /api/auth với cookie/CSRF.
Port5000 xác minh từ backend/run.py, chưa xác minh process đang chạy.

OTP hiện là development, mã 6 số hiển thị trong terminal Flask, chưa gửi SMS.
Backend cần PostgreSQL và Redis Local,
APP_ENV=development, OTP_DEV_ENABLED=true cùng SECRET_KEY hợp lệ.
Không tự chạy migration để thử đăng nhập.

Nếu đổi `config/local.json` hoặc tham số dart-define, phải dừng/chạy lại Flutter;
hot reload không nạp lại cấu hình biên dịch. Nếu đổi Backend `.env`, khởi động lại
Backend để nạp origin mới. Không khởi động đồng thời hai ứng dụng trên cổng 5510.

Android Emulator:
`flutter run -d <ANDROID_DEVICE_ID> --dart-define=API_BASE_URL=http://10.0.2.2:5000/api`.
Android/iOS lưu token an toàn bằng flutter_secure_storage; Web chỉ giữ token RAM.
Dio là HTTP client duy nhất. Không lưu token trong localStorage/cookie.
Không có chọn vai trò demo hoặc DEMO_MODE trong luồng đăng nhập hiện tại.

```powershell
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

Đọc [hướng dẫn đăng nhập](../docs/MOBILE_AUTH.md),
[kiến trúc](../docs/MOBILE_ARCHITECTURE.md),
[Design System](../docs/MOBILE_DESIGN_SYSTEM.md) và
[API contract](../docs/MOBILE_API_CONTRACT.md).
Android SDK trên máy hiện còn licenses chưa chấp nhận; chưa build/test native.
Không tự chấp nhận điều khoản SDK.
