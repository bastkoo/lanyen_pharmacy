# Module 02.8.1 — Backend tài khoản nội bộ

## Phạm vi và model

Chỉ Backend quản lý nhân viên/quản lý, không Frontend, mật khẩu, SMS thật, hồ sơ nhân sự hoặc xóa tài khoản.

Model NguoiDung hiện có khớp yêu cầu: MaNguoiDung BigInteger PK tự tăng; HoTen String(255) NOT NULL; SDT String(15) UNIQUE NOT NULL; VaiTro Integer NOT NULL; TrangThai Boolean NOT NULL default/server_default false; Email String(255) nullable; AnhDaiDien Text nullable.

VaiTro 0 = khách, 1 = nhân viên, 2 = quản lý; TrangThai false = hoạt động, true = khóa. Không có MatKhau/PasswordHash/TenDangNhap/NgayTao/NgayCapNhat. Không sửa model, PostgreSQL schema, constraint/index, migration hoặc dữ liệu thật.

## API

Tất cả endpoint cần session quản lý đang hoạt động. Tiền tố `/api/manager/accounts`.

| Method | Path | Thành công |
| --- | --- | --- |
| GET | tiền tố | 200 ACCOUNTS_LISTED + items/page/per_page/total/pages |
| GET | tiền tố + `/<account_id>` | 200 ACCOUNT_FOUND + account |
| POST | tiền tố | 201 ACCOUNT_CREATED + account |
| PUT | tiền tố + `/<account_id>` | 200 ACCOUNT_UPDATED + account |
| PATCH | tiền tố + `/<account_id>/status` | 200 ACCOUNT_STATUS_UPDATED + account |

Không có DELETE. Danh sách và truy vấn đối tượng luôn giới hạn VaiTro IN (1,2). ID khách hàng hoặc ID không tồn tại trả ACCOUNT_NOT_FOUND, không cho nâng khách thành nội bộ qua PUT.

### Danh sách và bộ lọc

```text
GET /api/manager/accounts?search=Lan&role=1&status=false&page=1&per_page=20
```

- search: tên hoặc SDT, không phân biệt hoa thường; trim, tối đa 255 ký tự, không NUL. Tìm SDT có thể dùng tiền tố/số nội địa, loại các dấu định dạng phổ biến và chuyển tiền tố 0 thành +84 để đối chiếu SDT chuẩn hóa. Không sửa dữ liệu khi tìm.
- role: 1 hoặc 2; bỏ qua để lấy cả hai.
- status: chuỗi `true` (đã khóa) hoặc `false` (hoạt động); bỏ qua để lấy cả hai.
- page: mặc định 1, phạm vi 1–2147483647.
- per_page: mặc định 20, phạm vi 1–100.
- Sắp MaNguoiDung tăng dần. Rỗng trả items=[], total=0, pages=0. Không nhận tham số lạ/lặp lại. Search dùng query tham số hóa và escape ký tự LIKE.

### Tạo nhân viên

Đăng nhập bằng tài khoản quản lý hiện có qua Module 01, giữ cookie session và lấy X-CSRF-Token hiện tại. POST `/api/manager/accounts`:

```json
{
  "HoTen": "Nhân viên mới",
  "SDT": "0901234567",
  "VaiTro": 1,
  "Email": "staff@example.com",
  "AnhDaiDien": null
}
```

Ví dụ HTTP 201 (ID do PostgreSQL sinh):

```json
{
  "code": "ACCOUNT_CREATED",
  "account": {
    "MaNguoiDung": 42,
    "HoTen": "Nhân viên mới",
    "SDT": "+84901234567",
    "VaiTro": 1,
    "TrangThai": false,
    "Email": "staff@example.com",
    "AnhDaiDien": null
  }
}
```

Số điện thoại/ID trên chỉ minh họa. Không thực thi ví dụ ghi trên database thật để kiểm thử; dùng số được phép trên database thử nghiệm.

### Tạo quản lý

Cùng POST, đặt VaiTro=2 và dùng SDT chưa thuộc bất kỳ tài khoản nào:

```json
{
  "HoTen": "Quản lý mới",
  "SDT": "0901234568",
  "VaiTro": 2
}
```

Email/AnhDaiDien bỏ qua thì lưu NULL. TrangThai luôn false khi tạo; body gửi TrangThai bị từ chối. Không tạo OTP, proof, mật khẩu, token hoặc gửi SMS. Sau đó người dùng tự đăng nhập bằng SDT + OTP Module 01; cấu hình OTP development/Redis giữ nguyên.

Nếu SDT đã thuộc khách hàng/nhân viên/quản lý, trả 409 ACCOUNT_PHONE_EXISTS, không cập nhật hoặc nâng quyền bản ghi hiện có. Kiểm tra trước và bắt unique violation SQLSTATE 23505 để xử lý tranh chấp an toàn.

### Cập nhật thông tin

PUT `/api/manager/accounts/42` yêu cầu đủ HoTen, SDT, VaiTro:

```json
{
  "HoTen": "Nhân viên đã cập nhật",
  "SDT": "0901234569",
  "VaiTro": 1,
  "Email": null,
  "AnhDaiDien": "https://example.com/avatar.png"
}
```

Trả ACCOUNT_UPDATED với account bảy trường như trên. Email/AnhDaiDien tùy chọn: bỏ qua giữ nguyên, null hoặc chuỗi rỗng sau trim xóa về NULL. Không nhận MaNguoiDung hoặc TrangThai. Chỉ nhận VaiTro 1/2, không tự hạ quyền mình và không hạ quyền quản lý hoạt động cuối cùng.

Đổi SDT giữ nguyên MaNguoiDung. Session hiện tại dùng user_id nên vẫn xác định đúng tài khoản; đăng nhập OTP mới dùng số chuẩn hóa mới. Không chuyển session sang tài khoản khác hoặc tạo khách hàng trong thao tác cập nhật. Không tự chuyển số điện thoại đang thuộc người khác.

### Khóa/mở khóa

PATCH `/api/manager/accounts/42/status`:

```json
{ "TrangThai": true }
```

Trả ACCOUNT_STATUS_UPDATED + account với TrangThai=true. Đặt false để mở khóa. Không nhận 0/1 hoặc chuỗi boolean; không nhận thêm trường khác.

Không được tự khóa; không khóa quản lý hoạt động cuối cùng; không thao tác khách hàng. Không xóa NguoiDung hoặc dữ liệu liên quan. Mở khóa không thay vai trò.

## Validation

- HoTen: chuỗi sau trim 1–255 Unicode code points, không ký tự điều khiển/NUL theo hướng xử lý tên Module 01; không tự chuẩn hóa khoảng trắng nội bộ.
- SDT: tái sử dụng OtpRequestSchema và normalize_phone Module 01, raw tối đa 24 ký tự, chấp nhận định dạng di động VN hợp lệ 0... hoặc +84... và dấu định dạng đang được hỗ trợ. Lưu chuẩn +84, tối đa 15 ký tự theo model.
- VaiTro: JSON integer 1/2, không boolean/float/chuỗi.
- Email nếu có: email hợp lệ, tối đa 255 ký tự, nullable.
- AnhDaiDien nếu có: nullable hoặc URL HTTPS theo validator có sẵn; không upload, không tải URL từ máy chủ, không yêu cầu Cloudinary mới.
- Từ chối trường ngoài schema, đặc biệt ID, mật khẩu, trạng thái trong create/update và metadata không tồn tại. Repository update cũng whitelist HoTen/SDT/VaiTro/Email/AnhDaiDien; status chỉ gán TrangThai.

Output tái sử dụng UserSchema Module 01: chỉ MaNguoiDung, HoTen, SDT, VaiTro, TrangThai, Email, AnhDaiDien. Không có secret/OTP/session token trong account response.

## Đồng thời và session

Trước request, require_roles(2) đọc lại tài khoản bằng Module 01. Mọi request ghi sau đó:

1. Kết thúc transaction chỉ đọc do guard mở, tránh dùng snapshot trước thời điểm chờ khóa.
2. Lấy PostgreSQL `LOCK TABLE "NguoiDung" IN SHARE ROW EXCLUSIVE MODE` cho transaction ghi, theo pattern khóa bảng đã có ở module danh mục.
3. Đọc lại người thao tác với populate_existing để không dùng object ORM cache trước khóa. Nếu đã khóa/hạ quyền/xóa trong lúc chờ, từ chối thao tác; khóa/xóa tài khoản đang thao tác cũng dọn session theo guard hiện có.
4. Kiểm tra đối tượng nội bộ, trùng SDT, tự khóa/tự hạ quyền và đếm quản lý đang hoạt động trước khi hạ quyền/khóa.
5. Commit sau thành công; rollback khi lỗi. Giữ khóa suốt kiểm tra và ghi.

Các request ghi tài khoản được tuần tự hóa; count và update/status không tách thành hai transaction. Khóa bảng cũng xung đột với INSERT/UPDATE/DELETE khác trên NguoiDung nên đăng ký khách hàng/ghi trực tiếp có thể chờ transaction ngắn này. Không gọi Redis, OTP, mạng hoặc SMS trong vùng giữ khóa. GET không lấy khóa ghi hay commit.

Tradeoff: ghi tài khoản là thao tác ít thường xuyên, dùng khóa bảng để bảo vệ invariant chung mà không thêm bảng/constraint/session system. Chưa đo tải hoặc kiểm chứng tranh chấp PostgreSQL thật.

Module 01 đã kiểm tra TrangThai/vai trò mỗi request nên không cần sửa auth/session middleware. Sau khóa, request được bảo vệ tiếp theo trả ACCOUNT_LOCKED, xóa session; sau đó trả UNAUTHENTICATED. Không hứa hủy request đã chạy từ trước khi khóa.

## Mã lỗi

| HTTP | code | Ý nghĩa |
| --- | --- | --- |
| 400 | INVALID_REQUEST | Body/query/type/validation sai |
| 401 | UNAUTHENTICATED | Không có session hoặc tài khoản không còn tồn tại |
| 403 | FORBIDDEN | Không phải quản lý |
| 403 | ACCOUNT_LOCKED | Người thao tác đã khóa |
| 403 | CSRF_FAILED | Thiếu/sai CSRF hoặc Origin |
| 404 | ACCOUNT_NOT_FOUND | Không có tài khoản nội bộ trong phạm vi |
| 409 | ACCOUNT_PHONE_EXISTS | SDT đã thuộc tài khoản khác |
| 409 | CANNOT_DEMOTE_SELF | Tự hạ quyền |
| 409 | CANNOT_LOCK_SELF | Tự khóa |
| 409 | LAST_ACTIVE_MANAGER | Hạ quyền/khóa quản lý hoạt động cuối cùng |
| 415 | JSON_REQUIRED | Request ghi không dùng JSON |
| 503 | DATABASE_UNAVAILABLE | Lỗi database đã che thông tin nội bộ |

POST/PUT/PATCH cần cookie session và X-CSRF-Token, kiểm tra Origin hiện có. Responses dùng no-store/nosniff. Không đổi endpoint/response auth hoặc module trước.

## File tạo

- `backend/app/routes/account_routes.py`
- `backend/app/controllers/account_controller.py`
- `backend/app/services/account_service.py`
- `backend/app/repositories/account_repository.py`
- `backend/app/schemas/account_schema.py`
- `backend/tests/test_accounts.py`
- `backend/tests/check_accounts_live.py`
- `docs/MODULE_02_8_1_ACCOUNTS.md`

## File sửa

- `backend/app/__init__.py` — đăng ký account blueprint.

Không sửa Frontend, OTP implementation, model, migration, database hoặc config.

## Kết quả kiểm thử

Từ backend:

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -p test_accounts.py -v
# 35/35 đạt
.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
# 287/287 đạt; có ResourceWarning file tạm của bộ hồi quy, không có test thất bại
.venv\Scripts\python.exe tests/check_accounts_live.py
# PASS real Flask/PostgreSQL READ ONLY: 2 tài khoản nội bộ; list/detail/search,
# role/status filters, internal-only results và session/CSRF guards.
# SKIP real customer detail scope: database hiện không có khách hàng.
```

API/service tests mock repositories, chặn Engine.connect. Repository tests kiểm tra SQL PostgreSQL, khóa bảng/refresh ORM/scope/filter/count/whitelist, không thực thi SQL thật. Kiểm tra bảo vệ khách hàng, duplicate tất cả vai trò, nhập liệu, tự khóa/hạ quyền, quản lý cuối, khóa/mở khóa, session cũ bị khóa, recheck actor sau chờ khóa, CSRF/Origin, lỗi database/commit và che secret.

OTP regression trong bài riêng sử dụng controller/service/Lua hiện có với fakeredis và database mock: tạo nhân viên, đăng nhập OTP đúng tài khoản/VaiTro=1; đổi SDT nhân viên rồi đăng nhập số mới; đổi SDT chính mình vẫn giữ user_id/CSRF và session đúng người. Không gửi SMS hoặc dùng Redis/database thật.

Ba tình huống hai request đồng thời khóa chéo, hạ quyền chéo và khóa/hạ quyền hỗn hợp chạy bằng ThreadPoolExecutor, Barrier và mutex giả lập contract transaction repository: một request thành công, request còn lại bị từ chối sau recheck, vẫn còn một quản lý hoạt động. Đây **không phải** kiểm thử MVCC/khóa trên PostgreSQL thật.

Script thật chỉ đọc, dùng Flask test client với session ký cho quản lý hiện có; không in PII/SDT/token ra log. Không gọi request ghi vượt qua CSRF, không khóa bảng hoặc thay đổi tài khoản thật. Chưa kiểm thử tạo/sửa/khóa, unique race hoặc concurrency PostgreSQL thật, OTP thật hoặc Postman thật. Kiểm tra customer scope thật chưa chạy do không có customer; case này có unit tests mock và SQL scope tests.

Imports/khởi tạo Flask qua tests và git diff --check đạt. Không có thay đổi schema hoặc migration. Sau bàn giao dừng ở Module 02.8.1, chờ yêu cầu tiếp theo.
