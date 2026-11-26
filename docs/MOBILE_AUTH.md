# Đăng nhập Mobile bằng JWT

Quyết định mới: Flutter dùng JWT access/refresh token; Website tiếp tục dùng
cookie/session/CSRF trên /api/auth. Hai nhóm API độc lập, không đổi endpoint cũ.

**Làm rõ từ chủ dự án:** Đây là ứng dụng thật đang phát triển Local. OTP hiện đọc
từ terminal Flask theo chủ đích, chưa cần tích hợp SMS. Giao diện không hiển thị
nhãn demo/thử nghiệm. Bộ kiểm thử vẫn dùng fixtures cô lập để bảo vệ dữ liệu.
Chạy bằng F5 cấu hình **Lan Yến Mobile · Chrome Local** hoặc lệnh trong README;
Base URL lấy từ `mobile/config/local.json`. Đổi dart-define cần chạy lại Flutter.

## Luồng ứng dụng

Mở app → khôi phục token từ nơi lưu an toàn → GET mobile/auth/me.
Nếu access token hết hạn, refresh một lần rồi đọc lại thông tin người dùng.
Không có token vẫn vào trang chủ khách, xem sản phẩm và lưu giỏ cục bộ. Các mục
Điểm thưởng, Tư vấn/Nhắn tin, Tài khoản, Đơn của tôi mở hộp thoại yêu cầu đăng nhập.
Chọn Đăng nhập mới nhập số điện thoại → OTP 6 số:
- Người đã đăng ký: nhận token và user, chuyển shell theo VaiTro 0/1/2.
- Người mới: nhận registration_token, nhập họ tên rồi hoàn tất đăng ký.
- Tài khoản khóa/vai trò lạ: không mở shell.
Customer có trang chủ/danh sách/chi tiết và giỏ; sau đăng nhập gộp giỏ khách vào
database theo contract `MOBILE_API_CONTRACT.md`. Đăng xuất về trang chủ khách,
không sao chép giỏ tài khoản vào giỏ khách.
Không còn cổng chọn vai trò demo.

Đang dùng OTP development sẵn có: mã sinh 6 số, TTL 300s, cooldown 60s, giới hạn
số lần gửi/nhập được giữ nguyên. Backend in mã tại terminal Flask theo định dạng
[DEV OTP]; không gửi SMS thật và không trả OTP qua HTTP. Không tích hợp nhà cung
cấp SMS hoặc dùng số điện thoại cá nhân thật trong kiểm thử.

## API mới

Prefix /api/mobile/auth. Request JSON, không gửi cookie hoặc X-CSRF-Token từ Flutter.
Chỉ /me cần Authorization: Bearer <access_token>. Refresh/logout dùng refresh_token
trong JSON; không đặt token vào query/URL.

| Method/path | Request | Response thành công |
|---|---|---|
| POST otp/request | phone | OTP_SENT, challenge_token, expires_in, retry_after |
| POST otp/verify | challenge_token, otp (6 số) | AUTHENTICATED + user/token pair hoặc PROFILE_REQUIRED + registration_token |
| POST register | registration_token, ho_ten | AUTHENTICATED + user/token pair |
| GET me | Bearer access token | AUTHENTICATED + user |
| POST refresh | refresh_token | AUTHENTICATED + user/token pair mới |
| POST logout | refresh_token | LOGGED_OUT, thu hồi family |

Token pair: token_type=Bearer, access_token, refresh_token, expires_in.
User theo UserSchema hiện tại. Không nhận VaiTro từ request đăng ký.
Challenge/registration token chỉ giữ RAM trong lúc đăng nhập.

Error JSON chỉ có code: INVALID_PHONE, OTP_INVALID, OTP_EXPIRED,
OTP_ATTEMPTS_EXCEEDED, RATE_LIMITED, VERIFICATION_EXPIRED, INVALID_TOKEN,
TOKEN_EXPIRED, UNAUTHENTICATED, ACCOUNT_LOCKED, FORBIDDEN, AUTH_UNAVAILABLE,
DATABASE_UNAVAILABLE, INVALID_REQUEST, JSON_REQUIRED.
Không giả báo SMS, đăng nhập hoặc đăng xuất thành công khi request thất bại.
Không tự retry OTP/register/refresh khi request mất phản hồi.

## JWT và dữ liệu

- HS256, issuer lanyen-mobile, audience lanyen-mobile-app, kiểm tra signature,
  exp/iat/nbf/sub/jti/kind. Key ký được HMAC dẫn xuất riêng từ SECRET_KEY đã có,
  không dùng chuỗi JWT_SECRET_KEY mặc định và không đưa key vào Flutter.
- Access tối đa 15 phút; refresh family tối đa 8 giờ, không tự kéo dài khi refresh.
- Redis lưu user và HMAC jti refresh theo family, xoay nguyên tử bằng Lua.
  Dùng lại refresh token cũ thu hồi cả family; logout làm access cũ mất hiệu lực.
- Mỗi lần đọc phiên/refresh kiểm tra family và user/role/TrangThai hiện tại từ DB.
- Không thêm bảng/column, không migration. Redis dùng hạ tầng OTP sẵn có.
- Đăng nhập Web không được tạo/đổi/xóa bởi Mobile; Bearer Mobile không cấp quyền
  cho các API Web cũ. Tích hợp nghiệp vụ Mobile tiếp theo cần endpoint/guard JWT riêng.

Android/iOS lưu token bằng flutter_secure_storage (Keystore/Keychain);
Flutter Web chỉ giữ RAM, tải lại tab sẽ cần đăng nhập lại. Không dùng
SharedPreferences/localStorage/cookie cho token Mobile. Token không bị log.
Namespace storage gắn Base URL để không trộn phiên giữa môi trường.
Android tắt backup cho dữ liệu app; HTTP chỉ được phép ở debug cho
localhost/127.0.0.1/10.0.2.2, không nới TLS bản release.

Dio là HTTP client duy nhất, không bật cookie credentials cho Web, không gắn cookie
manager và không tự theo redirect trên native. Mọi endpoint method ở api.dart.
AppConfig không có URL mặc định; host/port phải được cấp qua dart-define.

## Chạy Local

Backend hiện có cần PostgreSQL/Redis Local, SECRET_KEY hợp lệ,
APP_ENV=development và OTP_DEV_ENABLED=true. Không tự sửa .env hoặc chạy migration.

Native Android Emulator, với entrypoint backend/run.py đã xác minh port5000:

```powershell
cd mobile
flutter pub get
flutter run -d <ANDROID_DEVICE_ID> --dart-define=API_BASE_URL=http://10.0.2.2:5000/api
```

Không có emulator/device kết nối trong phiên kiểm thử hiện tại. Android doctor
báo một số SDK licenses chưa được chấp nhận; chủ máy cần xem và tự chấp nhận
điều khoản phù hợp trước build. Không tự chấp nhận giấy phép.

Flutter Web để kiểm tra giao diện trên máy:

```powershell
flutter run -d chrome --web-hostname=127.0.0.1 --web-port=5510 --dart-define=API_BASE_URL=http://127.0.0.1:5000/api
```

Thêm origin Mobile vào cấu hình Backend khi cần:
MOBILE_AUTH_ALLOWED_ORIGINS=http://127.0.0.1:5510
Đây là biến mới chỉ cho /api/mobile/auth; AUTH_ALLOWED_ORIGINS của Website giữ nguyên.
Khởi động lại Backend để nạp cấu hình. Không dùng wildcard hoặc tắt CORS/TLS.
5000 chỉ xác minh qua source run.py, chưa xác minh process runtime hoặc LAN.
Thiết bị thật/iOS cần URL truy cập được, ưu tiên HTTPS; chưa cấu hình ngoại lệ ATS.

## Kiểm chứng và giới hạn

Backend: 45 tests Mobile + regression Web auth với fakeredis/repository mock pass.
Flutter: 35 tests unit/widget/HTTP transport pass; kiểm tra 320/360/390/430/600,
text scale 100/200%, ba bước, keyboard inset, semantics/targets/contrast và role routing.
Ảnh renderer các bước được xuất vào mobile/build/login-preview; không phải ảnh
TalkBack/VoiceOver hoặc thiết bị thật.

Kiểm thử nối trực tiếp Flutter Dio ↔ Flask JWT được cung cấp trong
backend/tests/mobile_auth_http_fixture.py và mobile/test/mobile_auth_http_test.dart.
Fixture chỉ dùng TESTING=true, fakeredis, repository mock và mã OTP cố định riêng
trong tiến trình test, không có lối bỏ qua xác thực trong API ứng dụng.
Test này mặc định skip nếu không truyền AUTH_HTTP_FIXTURE để tránh gọi DB thật.

Chưa xác minh SMS thật, PostgreSQL/Redis đang chạy của chủ máy, Android/iOS native,
secure storage trên thiết bị, TalkBack/VoiceOver hoặc các nghiệp vụ Website khác.

## Kết quả kiểm tra cuối

- Static analysis: No issues found; format 29 file, không còn thay đổi.
- 45 backend tests (JWT mới + auth Web cũ) pass.
- 35 unit/widget/transport tests Flutter pass; test HTTP tích hợp chạy riêng pass
  với Flutter Dio gọi đúng blueprint Flask, token JWT thật, Redis và DB giả lập.
- Flutter Web build và Wasm dry run thành công. Đã xem ảnh renderer phone/OTP/họ tên.
- Website frontend/ không đổi theo đối chiếu hash. Source Backend cũ chỉ bổ sung
  đăng ký blueprint ở app/__init__.py, biến Mobile origin ở config/config.py và
  dòng ví dụ trong .env.example. Auth routes/controllers/services/utils cũ giữ nguyên.
- Thấy hai file __pycache__ tương ứng init/config thay đổi trong runtime; không
  ghi đè hoặc hoàn tác cache. Không có thay đổi source ngoài phạm vi.
- Không sửa .env thật, schema, migration hoặc chạy giao dịch/DB thật.
- Phiên HTTP fixture đã đóng sau kiểm thử. Không commit/push/merge.

OTP và rate limits dùng chung hạ tầng hiện có với Website. Xin mã mới cho cùng số
điện thoại sẽ thay mã trước đó theo quy tắc OTP hiện tại, không tạo chính sách mới.

Có thể chạy lại kiểm thử tích hợp bằng hai terminal:

```powershell
# Terminal 1, trong backend/; chỉ chạy fixture cô lập này.
.venv/Scripts/python.exe -B -m tests.mobile_auth_http_fixture
# Ghi lại MOBILE_AUTH_FIXTURE_PORT được in ra.
```

```powershell
# Terminal 2, trong mobile/; PORT lấy từ fixture, không dùng Backend thật.
flutter test --dart-define=AUTH_HTTP_FIXTURE=http://127.0.0.1:PORT/api test/mobile_auth_http_test.dart
```

Fixture chỉ có dữ liệu trong RAM, kiểm tra marker trước khi Flutter gửi OTP;
không dùng để thay entrypoint Backend của Website.
