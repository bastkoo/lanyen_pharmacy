# Module 02.1 — Backend quản lý danh mục thuốc

Chỉ triển khai CRUD `LoaiThuoc`. Cả năm API chỉ dành cho tài khoản `VaiTro=2`,
được đọc lại trạng thái/vai trò trên mỗi request bằng session guard Module 01.
`TrangThai=True` là tài khoản bị khóa. POST/PUT/DELETE yêu cầu CSRF Module 01.
Không sử dụng JWT cho các API này.

## API

Tiền tố: `/api/manager/categories`. Response JSON có `code`; dữ liệu danh mục chỉ
có `MaLoaiThuoc` và `TenLoaiThuoc`.

| Method | URL | Kết quả thành công |
| --- | --- | --- |
| GET | `/api/manager/categories?search=giảm&page=1&per_page=20` | 200, `CATEGORIES_LISTED`, `items`, `page`, `per_page`, `total`, `pages` |
| GET | `/api/manager/categories/3` | 200, `CATEGORY_FOUND`, `category` |
| POST | `/api/manager/categories` | 201, `CATEGORY_CREATED`, `category` |
| PUT | `/api/manager/categories/3` | 200, `CATEGORY_UPDATED`, `category` |
| DELETE | `/api/manager/categories/3` | 200, `CATEGORY_DELETED` |

POST/PUT nhận JSON đầy đủ:

```json
{"TenLoaiThuoc": "  Thuốc   giảm đau  "}
```

Tên được bỏ khoảng trắng đầu/cuối, gộp chuỗi khoảng trắng thành một dấu cách:
`Thuốc giảm đau`. Kiểm tra độ dài 1–255 sau chuẩn hóa. Từ chối null, kiểu dữ liệu
khác chuỗi, ký tự NUL và trường ngoài schema (kể cả `MaLoaiThuoc`).
PUT giữ nguyên tên hiện tại là hợp lệ; tên đã thuộc danh mục khác trả 409.

Danh sách sắp theo `MaLoaiThuoc` tăng dần. `search` tìm chuỗi con không phân biệt
hoa thường, `%` và `_` được hiểu là ký tự thường. `page` mặc định 1, phạm vi
1–2147483647; `per_page` mặc định 20, phạm vi 1–100. Trang vượt kết quả trả danh
sách rỗng; danh sách không có kết quả trả `pages=0`. `search` tối đa 255 ký tự sau
chuẩn hóa khoảng trắng.

| HTTP | code | Ý nghĩa |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | JSON, tên, trường đầu vào hoặc phân trang không hợp lệ |
| 401 | `UNAUTHENTICATED` | Chưa đăng nhập/session không còn hợp lệ/người dùng không tồn tại |
| 403 | `FORBIDDEN` | Không phải quản lý |
| 403 | `ACCOUNT_LOCKED` | Tài khoản bị khóa; session bị xóa |
| 403 | `CSRF_FAILED` | Token thiếu/sai hoặc Origin không được phép |
| 404 | `CATEGORY_NOT_FOUND` | Danh mục không tồn tại |
| 409 | `CATEGORY_NAME_EXISTS` | Tên trùng sau chuẩn hóa, không phân biệt hoa thường |
| 409 | `CATEGORY_IN_USE` | Danh mục đang được thuốc tham chiếu |
| 415 | `JSON_REQUIRED` | POST/PUT không có Content-Type JSON |
| 503 | `DATABASE_UNAVAILABLE` | Lỗi database được che thông tin nội bộ |

## Transaction và bảo vệ dữ liệu

Không có unique constraint cho tên trong schema hiện có. Repository khóa bảng
`LoaiThuoc` bằng `SHARE ROW EXCLUSIVE` trong transaction ghi để tuần tự hóa kiểm
tra trùng và ghi từ các API này. Đọc danh mục vẫn được phép. Các lần ghi danh mục
đồng thời phải chờ nhau; không thêm constraint/index hoặc thay đổi schema.
Kiểm tra trùng dùng PostgreSQL `regexp_replace`, `trim`, `lower` cho cả tên đã có
khoảng trắng dư. Quy tắc chữ hoa/thường của database phụ thuộc locale PostgreSQL.
Các tiến trình ghi trực tiếp ngoài API vẫn phải tuân thủ cùng quy tắc kiểm tra tên.

Xóa chỉ phát lệnh DELETE cho `LoaiThuoc`, không xóa thuốc. Kiểm tra tham chiếu trước
khi xóa; nếu thuốc được thêm đồng thời sau kiểm tra, lỗi FK PostgreSQL `23503`
vẫn được rollback và chuyển thành 409. Migration hiện tại không đặt ON DELETE
CASCADE. Lỗi SQLAlchemy khác được rollback và trả mã an toàn, không trả SQL,
traceback hoặc credentials.

## Kiểm thử bằng Postman

Chỉ thực hiện thao tác ghi trên database thử nghiệm được phép dùng. Hướng dẫn
này không được thực thi tự động và không cần tạo thuốc để kiểm tra module.

1. Chạy Backend theo [Module 01](MODULE_01_AUTH.md), Redis sẵn sàng cho OTP.
   Trong Postman đặt `base_url=http://localhost:5000` (hoặc URL server đang chạy).
   Dùng cùng hostname trong toàn bộ luồng để cookie session hoạt động. Nếu server
   cấu hình cookie Secure thì dùng HTTPS; HTTP local cần cấu hình phát triển tương
   ứng như Module 01. Không sửa `.env` hoặc vai trò người dùng bằng API này.
2. Gọi `GET {{base_url}}/api/auth/me`. Kể cả khi nhận 401, lấy `csrf_token` từ JSON.
   Postman lưu cookie `lanyen_session` trong cookie jar. Có thể dùng script
   Post-response sau cho `/me` và `/otp/verify`:

   ```javascript
   const body = pm.response.json();
   if (body.csrf_token) pm.environment.set('csrf_token', body.csrf_token);
   ```

3. Gọi `POST /api/auth/otp/request` với JSON `{"phone":"<số quản lý hiện có>"}`
   và header `X-CSRF-Token: {{csrf_token}}`. Lấy OTP ở terminal development theo
   Module 01; gọi `POST /api/auth/otp/verify` với `phone` và `otp`, cùng header.
   Lưu token mới từ response đăng nhập vì token được xoay vòng. Tài khoản phải có
   `VaiTro=2` và `TrangThai=False`; đăng ký tài khoản mới chỉ tạo khách hàng.
4. Gọi GET danh sách với `search`, `page`, `per_page`; gọi GET chi tiết bằng ID
   thực tế. GET không cần CSRF nhưng cần cookie đăng nhập quản lý.
5. Gọi POST với body ví dụ phía trên, `Content-Type: application/json` và
   `X-CSRF-Token: {{csrf_token}}`. Lưu `category.MaLoaiThuoc` từ response 201.
6. Gọi PUT cùng ID, JSON `{"TenLoaiThuoc":"Thuốc giảm đau cập nhật"}` và header
   CSRF; mong đợi 200. Gửi tên rỗng hoặc trên 255 ký tự để nhận 400. Gửi tên đã
   có với khác hoa/thường hoặc khoảng trắng dư để nhận 409.
7. Gọi DELETE với ID vừa tạo và CSRF: danh mục chưa có thuốc trả 200; GET lại trả
   404. Với danh mục đang có thuốc trong dữ liệu thử nghiệm hiện hữu, DELETE trả
   409 và thuốc/danh mục được giữ lại. Không tạo thuốc trong module này.
8. Bỏ/sửa CSRF khi ghi để nhận 403; xóa cookie session để nhận 401. Dùng tài khoản
   khách hoặc nhân viên để xác nhận cả GET và thao tác ghi đều trả 403.

## Kiểm thử tự động

Chạy từ thư mục gốc dự án:

```powershell
$env:PYTHONPATH = 'backend'
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_categories.py -v
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_auth.py -v
```

Tests danh mục mock toàn bộ repository danh mục và tra cứu người dùng. Chặn
`Engine.connect` để thao tác kết nối PostgreSQL ngoài ý muốn gây lỗi test ngay.
Tests repository chỉ biên dịch SQL PostgreSQL và mock session.execute, không thực
thi SQL. Tests auth dùng repository mock và fakeredis theo Module 01.

Kết quả thực thi: 21/21 bài danh mục và 26/26 bài auth đạt (47/47 khi chạy
`unittest discover -s tests -p test_*.py -v` từ thư mục backend). Đã kiểm tra import,
khởi tạo ứng dụng, CRUD, validation, tìm kiếm/phân trang, tên trùng, tham chiếu
thuốc, lỗi FK đồng thời được mô phỏng, rollback, phân quyền, session và CSRF.
`git diff --check` không phát hiện lỗi whitespace.

Chưa kiểm thử tích hợp PostgreSQL thật, khóa đồng thời thực tế hoặc thao tác
Postman với tài khoản thật; cần kiểm chứng riêng trên môi trường thử nghiệm.

## Tệp triển khai

- Sửa `backend/app/__init__.py` để đăng ký blueprint.
- Tạo `backend/app/routes/category_routes.py`.
- Tạo `backend/app/controllers/category_controller.py`.
- Tạo `backend/app/services/category_service.py`.
- Tạo `backend/app/repositories/loai_thuoc_repository.py`.
- Tạo `backend/app/schemas/category_schema.py`.
- Tạo `backend/tests/test_categories.py`.
- Tạo `docs/MODULE_02_1_CATEGORIES.md`.

Không sửa models, 15 bảng, migration, `.env`, Frontend hoặc dependencies. Không
tạo/chạy migration và không thay đổi dữ liệu PostgreSQL thật trong quá trình kiểm
thử tự động. Không triển khai quản lý thuốc, đơn vị giá, lô thuốc hoặc Cloudinary.
