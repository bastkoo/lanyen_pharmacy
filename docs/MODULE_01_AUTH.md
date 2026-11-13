# Module 01 — Flask OTP trong môi trường phát triển

Đã thay Firebase bằng OTP do Flask quản lý. Giữ nguyên 15 bảng PostgreSQL, models,
repository và migration. Không chạy migration hoặc cập nhật dữ liệu để chuyển đổi.
Số điện thoại được đối chiếu theo E.164 (+84), cùng định dạng của luồng cũ.
Không tự chuyển đổi dữ liệu số điện thoại đang có trong database.

## Chạy trên Windows PowerShell

Redis chưa có trên localhost:6379 tại thời điểm kiểm tra. Không tự cài Docker hoặc
thay đổi hệ thống. Nếu đã có Docker Desktop đang chạy, mở terminal riêng và chạy:

```powershell
docker run --name lanyen-redis-dev --rm -p 127.0.0.1:6379:6379 redis:7-alpine
```

Container này chỉ dùng phát triển, dữ liệu bị bỏ khi container bị xóa. Có thể dùng Redis trong
WSL hoặc Redis được quản trị sẵn; đặt REDIS_URL tương ứng. Không có fallback bộ nhớ
Python trong ứng dụng. Khi Redis lỗi, API OTP trả AUTH_UNAVAILABLE (503).

Terminal backend, từ thư mục gốc dự án:

```powershell
cd D:\MaNguonMo\LanYenPharmacy
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
# Giữ DATABASE_URL và SECRET_KEY hiện có trong backend/.env.
# Nếu chưa có .env, tham khảo backend/.env.example và nhập cấu hình thật.
$env:APP_ENV = 'development'
$env:OTP_DEV_ENABLED = 'true'
$env:REDIS_URL = 'redis://127.0.0.1:6379/0'
$env:SESSION_COOKIE_SECURE = 'false'
$env:AUTH_ALLOWED_ORIGINS = 'http://localhost:5500,http://127.0.0.1:5500'
.\backend\.venv\Scripts\python.exe backend/run.py
```

Nếu cổng 5000 đã có server cũ, dừng server đó bằng Ctrl+C rồi chạy lại.
SECRET_KEY phải ngẫu nhiên, ít nhất 32 ký tự. Không ghi đè file .env đang có.
Không cần Firebase Web config hoặc Service Account để chạy ứng dụng.

Terminal frontend:

```powershell
cd D:\MaNguonMo\LanYenPharmacy
.\backend\.venv\Scripts\python.exe -m http.server 5500 --bind 127.0.0.1 --directory frontend
```

Mở **http://localhost:5500/**. Dùng thống nhất hostname localhost cho frontend và
backend; tránh mở HTML bằng file:// hoặc trộn localhost với 127.0.0.1.

## Thao tác OTP

1. Nhấn Đăng nhập, nhập số di động Việt Nam dạng 0901234567 hoặc +84901234567.
2. Nhấn Gửi mã OTP. Terminal Flask in `[DEV OTP] 4567: <mã ngẫu nhiên>`.
3. Nhập mã 6 chữ số trong vòng 5 phút. API không trả mã OTP.
4. Nếu tài khoản mới, nhập họ tên trong vòng 5 phút để hoàn tất hồ sơ.
5. Trang chủ hiển thị họ tên, số điện thoại và vai trò. Tải lại để kiểm tra session.
6. Nhấn Đăng xuất. Tài khoản hiện có không phải nhập lại họ tên khi đăng nhập sau.
7. Thử mã sai, mã đã dùng, mã hết hạn; gửi lại sau ít nhất 60 giây.

Mã mới thay mã cũ. Tối đa 5 lần sai mỗi OTP; 5 yêu cầu/số/giờ và 30 yêu cầu/IP/giờ
(kể cả lần bị cooldown từ chối). Xác minh tối đa 20 lần/số/5 phút và 60 lần/IP/5 phút.
Các giới hạn được chia sẻ qua Redis. IP lấy trực tiếp từ kết nối; không tin
X-Forwarded-For. Khi triển khai qua proxy cần cấu hình proxy tin cậy phù hợp.

## API

Mọi response auth dùng Cache-Control: no-store. Lấy CSRF trước qua GET /me,
kể cả khi nhận 401. Gửi cookie (credentials: include) và X-CSRF-Token cho POST.

| Method | Endpoint | JSON / kết quả |
| --- | --- | --- |
| POST | /api/auth/otp/request | `{ "phone": "0901234567" }` → OTP_SENT, expires_in, retry_after |
| POST | /api/auth/otp/verify | `{ "phone": "+84901234567", "otp": "123456" }` → AUTHENTICATED hoặc PROFILE_REQUIRED |
| POST | /api/auth/register | `{ "ho_ten": "Nguyễn An" }` → AUTHENTICATED |
| GET | /api/auth/me | AUTHENTICATED + user + csrf_token; hoặc UNAUTHENTICATED + csrf_token |
| POST | /api/auth/logout | `{}` → LOGGED_OUT |

Không còn endpoint /api/auth/firebase. Register dùng bằng chứng Redis ngắn hạn
trong session, gắn với số điện thoại và định danh phiên; không nhận phone/role từ
client. Trường ngoài schema bị từ chối. Mặc định VaiTro=0, TrangThai=False.
Tài khoản khóa hoặc vai trò ngoài 0/1/2 bị từ chối. Guard đọc lại trạng thái và
vai trò từ PostgreSQL trên mỗi request được bảo vệ.

OTP lưu HMAC-SHA256 với SECRET_KEY, không lưu mã thô trong Redis. Lua kiểm tra,
đếm số lần sai và tiêu thụ OTP nguyên tử; bằng chứng đăng ký cũng tiêu thụ nguyên
tử một lần. Nếu database lỗi sau khi tiêu thụ mã/bằng chứng, cần xác minh lại;
ứng dụng không mở lại bằng chứng đã dùng. Session cookie có chữ ký, HttpOnly,
SameSite=Lax, hết hạn 8 giờ; CSRF được đổi khi đăng nhập. Cookie chỉ chứa user ID,
CSRF và các định danh xác minh tạm thời, không chứa OTP, họ tên hoặc vai trò.
Đây là session cookie có chữ ký hiện có, không cung cấp thu hồi mọi bản sao cookie
đã đánh cắp ở server. Logout xóa cookie ở trình duyệt hiện tại.

## Production

APP_ENV=production, OTP_DEV_ENABLED=false, SESSION_COOKIE_SECURE=true, HTTPS,
SECRET_KEY mạnh và danh sách CORS origin cụ thể. Bật OTP giả lập ngoài development
làm ứng dụng từ chối khởi động. Khi giả lập tắt, endpoint gửi OTP trả 503; chưa tích
hợp nhà cung cấp SMS production. Phải tích hợp SMS thật hoặc phương thức xác thực
an toàn trước khi dùng production. Không chạy Flask debug trong production.

## Kiểm thử

```powershell
.\backend\.venv\Scripts\python.exe -m pip install -r backend/tests/requirements.txt
$env:PYTHONPATH = 'backend'
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_auth.py -v
node --test backend/tests/test_frontend.mjs
```

Bài backend chạy Lua thật trong fakeredis[lua], mock repository; không dùng hoặc
ghi PostgreSQL thật. Có kiểm thử đồng thời một OTP/một bằng chứng chỉ dùng một lần.

Browser smoke chạy Chrome có debugging port 9222 và frontend ở 5500:

```powershell
# Terminal riêng, chỉ chạy fixture khi muốn kiểm thử dữ liệu giả:
$env:PYTHONPATH = 'backend'
.\backend\.venv\Scripts\python.exe backend/tests/serve_auth_fixture.py
# Terminal khác:
node backend/tests/browser_auth.mjs --fixture
```

Fixture chỉ bind 127.0.0.1:5001, fake Redis + mock PostgreSQL và mã cố định 123456;
không được dùng fixture để chạy website thật. Cờ --fixture chỉ chuyển URL API trong
trang trình duyệt kiểm thử từ cổng 5000 sang 5001. Không thay cấu hình ứng dụng.
Chạy không có cờ này sẽ chỉ kiểm tra session khách/bố cục với backend thật ở 5000.

Kết quả thực thi: 26 bài backend, 5 bài frontend đạt. Browser fixture đạt luồng mã
sai → nhập mã đúng → tạo hồ sơ → tải lại session → đăng xuất → cooldown. Đã kiểm tra
viewport 1280, 768, 375 và 320 px, focus/Tab/Escape, nhãn, OTP autofill và xem ảnh
chụp desktop/mobile. Chưa kiểm thử screen reader hoặc khẳng định toàn bộ WCAG AA.
Chưa chạy tích hợp Redis server thật + PostgreSQL thật vì Redis local chưa sẵn sàng;
chưa xác minh PostgreSQL concurrency thực tế. Không thay dữ liệu hiện có.

## Tệp thay đổi

- Backend: app/__init__.py, config/config.py, controllers/auth_controller.py,
  routes/auth_routes.py, schemas/auth_schema.py, services/auth_service.py,
  utils/auth.py, requirements.txt, run.py, .env.example.
- Thêm services/otp_service.py; loại bỏ config/firebase.py.
- Frontend: js/api/auth.js, js/components/auth-dialog.js, js/config/app.js,
  js/pages/home.js, js/utils/auth-validation.js, pages/customer/home.html,
  css/components/auth.css; loại bỏ js/config/firebase.js.
- Tests: test_auth.py, test_frontend.mjs, browser_auth.mjs; thêm
  tests/requirements.txt và tests/serve_auth_fixture.py.
- Tài liệu: docs/MODULE_01_AUTH.md.
- frontend/index.html cùng các tệp frontend khác đã có thay đổi trước tác vụ;
  phần không liên quan được giữ nguyên.

Tham khảo thao tác Lua nguyên tử: https://redis.io/docs/latest/develop/programmability/eval-intro/
