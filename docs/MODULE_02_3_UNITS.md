# Module 02.3 — Backend đơn vị và giá thuốc

Đã đọc trực tiếp toàn bộ model trong `backend/app/models/`. Sử dụng class
DonViGiaThuoc, bảng DonVi_GiaThuoc với đúng năm trường MaDonGia, MaThuoc,
DonViTinh, GiaBan, SoLuongQuyDoi. Không có trạng thái kinh doanh hoặc tên trường
MaDonVi, DonVi, HeSoQuyDoi. Module này chưa có code trước khi triển khai.

## API

Tiền tố: `/api/manager/products/<product_id>/units`.

| Method | Đường dẫn | Thành công |
| --- | --- | --- |
| GET | tiền tố | 200, UNITS_LISTED, items, page, per_page, total, pages |
| GET | tiền tố + `/<unit_id>` | 200, UNIT_FOUND, unit |
| POST | tiền tố | 201, UNIT_CREATED, unit |
| PUT | tiền tố + `/<unit_id>` | 200, UNIT_UPDATED, unit |
| DELETE | tiền tố + `/<unit_id>` | 200, UNIT_DELETED |

POST và PUT yêu cầu đủ ba trường sau, không nhận MaThuoc hoặc MaDonGia từ body:

```json
{
  "DonViTinh": "Hộp",
  "GiaBan": 10000,
  "SoLuongQuyDoi": 10
}
```

MaThuoc lấy từ URL và phải tồn tại. Response unit trả đúng năm trường model,
ví dụ:

```json
{
  "code": "UNIT_CREATED",
  "unit": {
    "MaDonGia": 7,
    "MaThuoc": 3,
    "DonViTinh": "Hộp",
    "GiaBan": 10000,
    "SoLuongQuyDoi": 10
  }
}
```

DonViTinh được trim đầu/cuối, dài 1–50 ký tự; từ chối toàn khoảng trắng, null,
kiểu dữ liệu khác chuỗi và ký tự NUL. GiaBan nhận integer JSON từ 0 đến
2147483647; SoLuongQuyDoi từ 1 đến 2147483647 theo phạm vi Integer PostgreSQL.
Không nhận boolean, float hoặc chuỗi số thay integer. Không áp đặt tính duy nhất
cho đơn vị, quy tắc đơn vị cơ sở hay tự tính lại giá/quy đổi vì chưa có yêu cầu.
PUT cập nhật đầy đủ ba trường, không thay đổi MaThuoc. Từ chối mọi trường ngoài
schema, kể cả các tên trường cũ và các trường chỉ dùng để đọc.

GET danh sách hỗ trợ page (mặc định 1, tối đa 2147483647) và per_page (mặc định
20, phạm vi 1–100), sắp theo MaDonGia tăng dần. Danh sách không có kết quả trả
items=[] và pages=0. Trang vượt kết quả trả items=[]. Từ chối tham số lạ/lặp lại.

## Bảo mật, khóa ngoại và transaction

- Tái sử dụng require_roles(2), session và csrf_protect Module 01. Mọi API kiểm
  tra tài khoản hiện tại từ database, trạng thái khóa và vai trò. GET cần session;
  POST/PUT/DELETE cần thêm X-CSRF-Token và Origin hợp lệ nếu có Origin header.
- Truy vấn chi tiết/cập nhật/xóa ràng buộc đồng thời MaThuoc và MaDonGia. Đơn vị
  thuộc thuốc khác trả UNIT_NOT_FOUND; không cho chuyển đơn vị sang thuốc khác.
- PUT/DELETE khóa dòng đơn giá trong transaction. Service commit sau thành công,
  rollback lỗi nghiệp vụ hoặc SQLAlchemy.
- GioThuoc và ChiTietDonHang tham chiếu MaDonGia. Kiểm tra trước khi xóa, trả 409
  nếu có tham chiếu. DELETE chỉ tác động DonVi_GiaThuoc, không cascade. Migration
  hiện tại không khai báo ON DELETE CASCADE.
- PostgreSQL FK tiếp tục bảo vệ tranh chấp đồng thời sau pre-check. SQLSTATE
  23503 trả 409; lỗi database khác trả 503, không trả SQL/traceback/credentials.
- Response dùng Cache-Control: no-store và X-Content-Type-Options: nosniff.

| HTTP | code | Ý nghĩa |
| --- | --- | --- |
| 400 | INVALID_REQUEST | JSON, trường dữ liệu hoặc phân trang sai |
| 401 | UNAUTHENTICATED | Không có session hợp lệ hoặc tài khoản không tồn tại |
| 403 | FORBIDDEN | Không phải VaiTro=2 |
| 403 | ACCOUNT_LOCKED | Tài khoản khóa; xóa session |
| 403 | CSRF_FAILED | Thiếu/sai token hoặc Origin không được phép |
| 404 | PRODUCT_NOT_FOUND | Thuốc ở URL không tồn tại |
| 404 | UNIT_NOT_FOUND | Đơn giá không tồn tại hoặc thuộc thuốc khác |
| 409 | UNIT_IN_USE | Đơn giá đang được tham chiếu khi xóa |
| 409 | FOREIGN_KEY_CONFLICT | Lỗi FK khi tạo/cập nhật |
| 415 | JSON_REQUIRED | POST/PUT không dùng Content-Type JSON |
| 503 | DATABASE_UNAVAILABLE | Lỗi database còn lại |

## Kiểm thử Postman

Chỉ ghi trên database thử nghiệm được cho phép. Dùng server và luồng OTP theo
[Module 01](MODULE_01_AUTH.md), tài khoản quản lý hiện có VaiTro=2, TrangThai=False.

1. GET /api/auth/me để lấy csrf_token (kể cả response 401), giữ cookie session.
2. POST /api/auth/otp/request và /api/auth/otp/verify với phone/otp và header
   X-CSRF-Token theo Module 01. Lưu token mới sau đăng nhập vì token xoay vòng.
3. GET /api/manager/products lấy product_id của thuốc thử nghiệm hiện có.
4. POST /api/manager/products/{product_id}/units với JSON mẫu, Content-Type
   application/json, cookie đăng nhập và X-CSRF-Token: <token hiện tại>.
   Mong đợi 201; lưu unit.MaDonGia làm unit_id.
5. GET danh sách, thử ?page=1&per_page=20; GET chi tiết theo unit_id, mong đợi 200.
6. PUT cùng URL chi tiết, gửi đủ ba trường với giá/đơn vị/quy đổi mới; mong đợi 200.
7. Đổi product_id sang thuốc khác đang tồn tại, giữ unit_id: GET/PUT/DELETE trả
   404 UNIT_NOT_FOUND và không thay đổi đơn giá gốc.
8. DELETE đơn giá thử nghiệm chưa có tham chiếu trả 200; GET lại trả 404. Với đơn
   giá đã có tham chiếu trong dữ liệu test hiện hữu, DELETE trả 409 UNIT_IN_USE.
   Không tạo đơn hàng/giỏ hàng thật để thử. Trường hợp này có unit tests mock.
9. Thử số âm, quy đổi 0, boolean thay integer, tên rỗng/quá dài, thiếu trường
   hoặc thêm TrangThai/MaDonVi/DonVi/HeSoQuyDoi: trả 400.
10. Xóa cookie để nhận 401; dùng khách/nhân viên để nhận 403; bỏ/sửa CSRF ở thao
    tác ghi để nhận 403. Giữ cùng hostname để cookie jar hoạt động; HTTPS cần
    thiết nếu cookie Secure được bật.

## Unit tests

Từ thư mục gốc dự án:

```powershell
$env:PYTHONPATH = 'backend'
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_units.py -v
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_*.py -v
```

Tests Module 02.3 mock repositories đơn giá/thuốc/người dùng và chặn Engine.connect.
Tests repository mock session, biên dịch SQL PostgreSQL, không thực thi SQL thật.
Kiểm tra metadata để xác nhận đủ các FK tham chiếu, scope thuốc của SELECT/DELETE,
khóa dòng, commit/rollback, CRUD, validation, phân quyền, CSRF và lỗi PostgreSQL.

Kết quả thực thi: 25/25 bài Module 02.3 đạt; hồi quy toàn bộ Backend đạt 106/106
(25 đơn vị/giá + 34 thuốc + 21 danh mục + 26 auth). Imports và khởi tạo Flask
được kiểm chứng trong tests. `git diff --check` không phát hiện lỗi whitespace.

Chưa chạy Postman với tài khoản thật hoặc kiểm thử tích hợp PostgreSQL thật,
đặc biệt khóa transaction/tranh chấp đồng thời thực tế. Các tình huống FK đồng
thời được mô phỏng bằng IntegrityError trong unit tests.

## Tệp thay đổi

- Sửa backend/app/__init__.py để đăng ký blueprint units.
- Tạo backend/app/routes/unit_routes.py.
- Tạo backend/app/controllers/unit_controller.py.
- Tạo backend/app/services/unit_service.py.
- Tạo backend/app/repositories/don_vi_gia_thuoc_repository.py.
- Tạo backend/app/schemas/unit_schema.py.
- Tạo backend/tests/test_units.py.
- Tạo docs/MODULE_02_3_UNITS.md.

Không sửa model, 15 bảng PostgreSQL, migration, Frontend, dependencies hoặc .env.
Không tạo/chạy migration; không sử dụng/thay đổi dữ liệu PostgreSQL thật khi test.
