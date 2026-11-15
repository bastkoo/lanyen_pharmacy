# Module 02.7.1 — Backend CRUD chương trình khuyến mãi

## Phạm vi và model đã xác minh

Chỉ CRUD chương trình; không triển khai chi tiết khuyến mãi, gán thuốc, giá giảm, giỏ hàng hoặc Frontend. Không triển khai Module 02.7.2.

Model `ChuongTrinhKhuyenMai`, bảng `ChuongTrinhKhuyenMai`, khớp migration hiện có:

| Trường | Kiểu | Ràng buộc hiện có |
| --- | --- | --- |
| MaChuongTrinh | Integer | Primary key, autoincrement |
| TenChuongTrinh | String(255) | NOT NULL |
| NgayBatDau | Date | NOT NULL |
| NgayKetThuc | Date | NOT NULL |

`ChiTietKhuyenMai` có khóa chính kép `(MaChuongTrinh, MaThuoc)`, đồng thời là hai khóa ngoại đến chương trình và thuốc; các trường còn lại là `LoaiGiamGia` Boolean, `GiaTriGiam` Numeric(12,2), `SoLuong` Integer. Khóa ngoại đến chương trình không khai báo ON DELETE CASCADE. Module này chỉ đọc sự tồn tại của chi tiết để bảo vệ xóa; không ghi vào chi tiết hoặc thuốc.

Không có khác biệt với yêu cầu; không tạo lại hoặc sửa model, bảng, cột, constraint, index hoặc migration. Không chạy lệnh migration hay thay đổi dữ liệu thật.

## API

Tiền tố: `/api/manager/promotions`.

| Method | Đường dẫn | Thành công |
| --- | --- | --- |
| GET | tiền tố | 200 PROMOTIONS_LISTED, items/page/per_page/total/pages |
| GET | tiền tố + `/<promotion_id>` | 200 PROMOTION_FOUND, promotion |
| POST | tiền tố | 201 PROMOTION_CREATED, promotion |
| PUT | tiền tố + `/<promotion_id>` | 200 PROMOTION_UPDATED, promotion |
| DELETE | tiền tố + `/<promotion_id>` | 200 PROMOTION_DELETED |

GET danh sách dùng `page` mặc định 1, phạm vi 1–2147483647; `per_page` mặc định 20, phạm vi 1–100. Tái sử dụng UnitQuerySchema của Backend. Sắp xếp MaChuongTrinh tăng dần. Không có kết quả trả items=[], total=0, pages=0; trang vượt kết quả trả items=[]. Tham số lạ hoặc lặp lại bị từ chối. Không thêm search, trạng thái hoặc bộ lọc thời gian trong bước CRUD này.

POST và PUT yêu cầu đủ ba trường sau, Content-Type application/json:

```json
{
  "TenChuongTrinh": "Khuyến mãi tháng 11",
  "NgayBatDau": "2026-11-01",
  "NgayKetThuc": "2026-11-30"
}
```

Ví dụ POST thành công, HTTP 201 (ID do database sinh):

```json
{
  "code": "PROMOTION_CREATED",
  "promotion": {
    "MaChuongTrinh": 7,
    "TenChuongTrinh": "Khuyến mãi tháng 11",
    "NgayBatDau": "2026-11-01",
    "NgayKetThuc": "2026-11-30"
  }
}
```

PUT `/api/manager/promotions/7` với cùng cấu trúc body, ví dụ đổi TenChuongTrinh và NgayKetThuc; response dùng `PROMOTION_UPDATED` và object promotion với ID 7. GET chi tiết dùng `PROMOTION_FOUND` cùng object bốn trường. GET danh sách trả:

```json
{
  "code": "PROMOTIONS_LISTED",
  "items": [
    {
      "MaChuongTrinh": 7,
      "TenChuongTrinh": "Khuyến mãi tháng 11",
      "NgayBatDau": "2026-11-01",
      "NgayKetThuc": "2026-11-30"
    }
  ],
  "page": 1,
  "per_page": 20,
  "total": 1,
  "pages": 1
}
```

DELETE chưa có chi tiết trả `{"code":"PROMOTION_DELETED"}`. Nếu đã có chi tiết trả HTTP 409, `{"code":"PROMOTION_IN_USE"}`: không thể xóa chương trình đang được chi tiết khuyến mãi tham chiếu. Response chỉ dùng code theo chuẩn hiện có; không thêm định dạng lỗi mới.

## Validation và bảo vệ dữ liệu

- Tên phải là chuỗi, trim đầu/cuối, dài 1–255 Unicode code points, không NUL. Giữ nguyên khoảng trắng bên trong tên. Tên rỗng, toàn khoảng trắng, null, boolean, số, array/object bị từ chối.
- Ngày bắt buộc là chuỗi đúng YYYY-MM-DD và ngày lịch hợp lệ. Không nhận datetime, ngày thiếu số 0, số, boolean hoặc null.
- Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu. Cho phép chương trình một ngày, trong quá khứ, trùng tên hoặc trùng khoảng thời gian. Không tự áp tính duy nhất.
- Từ chối tất cả trường ngoài schema, bao gồm MaChuongTrinh, TrangThai, MoTa, MaGiamGia, MaThuoc hoặc chi tiết lồng nhau. Không cập nhật khóa chính.
- Không thêm hoặc trả trường trạng thái tính toán vì bước này không cần trạng thái. Không có cột TrangThai hoặc logic ngày hiện tại mới.

PUT/DELETE khóa dòng chương trình bằng SELECT FOR UPDATE. DELETE kiểm tra EXISTS chi tiết trước khi xóa; nếu có tham chiếu, rollback và trả 409. DELETE chỉ nhắm bảng cha bằng SQLAlchemy Core, không gọi cascade hoặc xóa thuốc. Khóa ngoại PostgreSQL hiện có bảo vệ tranh chấp đồng thời; IntegrityError SQLSTATE 23503 khi DELETE được chuyển thành PROMOTION_IN_USE. Lỗi SQLAlchemy khác trả DATABASE_UNAVAILABLE, không lộ SQL/traceback/credentials.

Service commit sau thao tác ghi thành công; rollback khi lỗi nghiệp vụ/database/commit. GET không ghi dữ liệu hoặc commit.

## Authentication và lỗi

Tái sử dụng `require_roles(2)`, Flask session và `csrf_protect`. Mỗi request kiểm tra lại tài khoản từ database. VaiTro 0/1 không có quyền; tài khoản khóa bị từ chối và xóa session. POST/PUT/DELETE cần cookie session, X-CSRF-Token hiện tại và Origin hợp lệ nếu gửi Origin. Dùng luồng đăng nhập OTP đã có; không thêm bypass đăng nhập.

| HTTP | code | Ý nghĩa |
| --- | --- | --- |
| 400 | INVALID_REQUEST | JSON, trường dữ liệu hoặc query không hợp lệ |
| 401 | UNAUTHENTICATED | Chưa đăng nhập hoặc tài khoản không tồn tại |
| 403 | FORBIDDEN | Không phải quản lý |
| 403 | ACCOUNT_LOCKED | Tài khoản đã khóa |
| 403 | CSRF_FAILED | Sai/thiếu CSRF hoặc Origin không được phép |
| 404 | PROMOTION_NOT_FOUND | Chương trình không tồn tại |
| 409 | PROMOTION_IN_USE | Chương trình có chi tiết liên quan, không thể xóa |
| 415 | JSON_REQUIRED | POST/PUT không dùng JSON |
| 503 | DATABASE_UNAVAILABLE | Lỗi database đã rollback, không trả chi tiết nội bộ |

Responses có Cache-Control: no-store và X-Content-Type-Options: nosniff, kể cả lỗi xác thực của blueprint.

## Tệp tạo

- `backend/app/routes/promotion_routes.py`
- `backend/app/controllers/promotion_controller.py`
- `backend/app/services/promotion_service.py`
- `backend/app/repositories/chuong_trinh_khuyen_mai_repository.py`
- `backend/app/schemas/promotion_schema.py`
- `backend/tests/test_promotions.py`
- `docs/MODULE_02_7_1_PROMOTIONS.md`

## Tệp sửa

- `backend/app/__init__.py` — đăng ký promotion blueprint.

Không sửa API cũ, Frontend, models, migration, dependencies hoặc cấu hình.

## Kiểm thử

Từ thư mục backend:

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -p test_promotions.py -v
.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
```

30/30 bài Module 02.7.1 đạt; hồi quy toàn bộ Backend đạt 219/219 bài. Kiểm tra CRUD/response/phân trang, tên, ngày lịch/leap year/ngày bằng nhau/ngày quá khứ, trùng tên/khoảng thời gian được chấp nhận, trường lạ/ID, malformed JSON, thiếu trường, chương trình không tồn tại, xóa có/không có chi tiết, FK race, khóa dòng, SQL parent-only, whitelist update, commit/rollback, lỗi database che thông tin, anonymous/khách/nhân viên/quản lý/tài khoản khóa/tài khoản bị xóa/quyền thay đổi, CSRF/Origin và cache headers.

Tests API/service mock repositories và chặn Engine.connect. Tests repository mock db.session, biên dịch SQL theo dialect PostgreSQL và kiểm tra FK metadata thực tế, không thực thi SQL thật. Flask app/blueprint/import được kiểm tra qua khởi tạo app trong tests. `git diff --check` không phát hiện lỗi whitespace.

## Giới hạn xác minh

Chưa chạy CRUD/Postman trên PostgreSQL thật hoặc thử khóa/tranh chấp đồng thời thật; không tuyên bố kiểm thử tích hợp database. FK race được mô phỏng bằng IntegrityError. Chưa kiểm thử OTP thật trong module này; dùng session test có guard thật và tài khoản repository mock. Không thay đổi dữ liệu thật để kiểm thử.

Bộ hồi quy toàn Backend phát một số ResourceWarning về file tạm chưa đóng/được dọn ngầm; không có bài thất bại. Chưa điều tra nguồn cảnh báo hoặc sửa các test ngoài phạm vi module này.

Module 02.7.1 dừng tại CRUD bảng chương trình, chờ yêu cầu tiếp theo trước khi triển khai Module 02.7.2.
