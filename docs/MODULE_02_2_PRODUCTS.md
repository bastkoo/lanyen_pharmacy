# Module 02.2 — Backend quản lý thuốc

Triển khai theo model `backend/app/models/thuoc.py` và migration hiện có. Không
có `GhiChu`. Không sửa model, schema PostgreSQL, migration hoặc Frontend.
Không triển khai upload Cloudinary, CRUD đơn vị giá hoặc lô thuốc.

## API và bảo mật

Cả năm API chỉ dành cho `VaiTro=2`. Guard Module 01 đọc lại tài khoản, vai trò,
trạng thái trên mỗi request; `TrangThai=True` nghĩa là bị khóa và xóa session.
POST/PUT/DELETE yêu cầu cookie session và `X-CSRF-Token`, kiểm tra Origin theo
cấu hình hiện có. GET cần session quản lý, không cần CSRF. Không đổi luồng auth.
Responses dùng `Cache-Control: no-store` và `X-Content-Type-Options: nosniff`.

| Method | Endpoint | Thành công |
| --- | --- | --- |
| GET | `/api/manager/products` | 200, `PRODUCTS_LISTED`, items và metadata phân trang |
| GET | `/api/manager/products/<id>` | 200, `PRODUCT_FOUND`, product |
| POST | `/api/manager/products` | 201, `PRODUCT_CREATED`, product |
| PUT | `/api/manager/products/<id>` | 200, `PRODUCT_UPDATED`, product |
| DELETE | `/api/manager/products/<id>` | 200, `PRODUCT_DELETED` |

Danh mục có thể lấy ID từ API Module 02.1. POST/PUT nhận JSON các trường model
ngoài `MaThuoc`. Mọi trường đều bắt buộc, ngoại trừ `PhanLoai`: khi POST bỏ qua
thì mặc định false; khi PUT bỏ qua thì giữ nguyên giá trị hiện tại. PUT cần đầy
đủ các trường bắt buộc, không phải cập nhật từng trường kiểu PATCH.

```json
{
  "MaLoaiThuoc": 2,
  "HinhAnh": "https://example.com/medicine-test.jpg",
  "TenThuoc": "Thuốc kiểm thử Module 02.2",
  "MoTa": "Dữ liệu giả lập dùng kiểm thử API",
  "MaDuoc": "TEST-MD-022",
  "SoDangKy": "TEST-SDK-022",
  "DangBaoChe": "Dữ liệu kiểm thử",
  "QuyCachDongGoi": "Dữ liệu kiểm thử",
  "NhaSanXuat": "Dữ liệu kiểm thử",
  "NuocSanXuat": "Dữ liệu kiểm thử",
  "CachDung": "Dữ liệu kiểm thử",
  "ChongChiDinh": "Dữ liệu kiểm thử",
  "BaoQuan": "Dữ liệu kiểm thử",
  "NguongTonKho": 0,
  "PhanLoai": false
}
```

Ví dụ trên chỉ là dữ liệu giả lập cho môi trường thử nghiệm; thay MaLoaiThuoc
bằng ID thực tế của danh mục trong database thử nghiệm. Backend chỉ lưu URL ảnh,
không tải URL hoặc xác minh nội dung ảnh trên server bên ngoài.

## Validation

- Chuỗi được trim đầu/cuối; không chấp nhận chuỗi rỗng, toàn khoảng trắng, null,
  kiểu dữ liệu khác hoặc ký tự NUL. Giữ nguyên nội dung/khoảng trắng bên trong.
- TenThuoc tối đa 255; MaDuoc 50; SoDangKy 100; DangBaoChe, QuyCachDongGoi,
  NhaSanXuat, NuocSanXuat tối đa 255. Text không đặt giới hạn độ dài tùy ý.
- HinhAnh là URL HTTPS hợp lệ; từ chối URL thiếu host, cổng sai, dấu gạch chéo
  ngược hoặc khoảng trắng trong URL. Không gọi mạng để kiểm tra URL.
- MaLoaiThuoc là integer 1–2147483647 và phải tồn tại.
- NguongTonKho là integer 0–2147483647 theo kiểu Integer PostgreSQL, không nhận
  boolean, float hoặc chuỗi số.
- PhanLoai chỉ nhận boolean JSON true/false, không nhận 0/1 hoặc chuỗi.
- Từ chối trường ngoài schema, kể cả MaThuoc, GhiChu hoặc VaiTro.
- Không kiểm tra duy nhất MaDuoc/SoDangKy hoặc tên thuốc vì chưa có yêu cầu này.

## Tìm kiếm, lọc và sắp xếp

```text
GET /api/manager/products?search=TEST&category_id=2&phan_loai=false&page=1&per_page=20&sort_by=TenThuoc&sort_order=asc
```

| Tham số | Quy tắc |
| --- | --- |
| search | Chuỗi con không phân biệt hoa thường trên TenThuoc OR MaDuoc OR SoDangKy; mặc định rỗng, tối đa 255 ký tự |
| category_id | ID danh mục integer dương; không truyền để lấy tất cả danh mục |
| phan_loai | Chỉ `true` hoặc `false` chữ thường; không truyền để lấy cả hai |
| page | Mặc định 1; phạm vi 1–2147483647 |
| per_page | Mặc định 20; phạm vi 1–100 |
| sort_by | MaThuoc (mặc định), TenThuoc, MaDuoc, SoDangKy, MaLoaiThuoc, NguongTonKho, PhanLoai |
| sort_order | asc (mặc định) hoặc desc |

Các điều kiện lọc được kết hợp AND với tìm kiếm. `%` và `_` trong search được
escape để tìm ký tự thường. Không nối SQL từ query string; cột sắp xếp được ánh
xạ từ danh sách cho phép. Dùng MaThuoc tăng dần làm thứ tự phụ để phân trang ổn
định khi giá trị cột sắp xếp trùng nhau. Từ chối tham số lạ hoặc lặp lại.
Danh mục lọc không có thuốc/không tồn tại trả danh sách rỗng, không phải 404.

```json
{
  "code": "PRODUCTS_LISTED",
  "items": [],
  "page": 1,
  "per_page": 20,
  "total": 0,
  "pages": 0
}
```

## Xóa, transaction và lỗi

Repository kiểm tra tham chiếu đến Thuoc từ ChiTietDonHang, ChiTietKhuyenMai,
DonVi_GiaThuoc, GioThuoc và LoThuoc. Chỉ đọc các bảng này để bảo vệ thao tác xóa;
không triển khai nghiệp vụ của các bảng đó. UPDATE/DELETE khóa dòng thuốc trong
transaction; DELETE chỉ tác động dòng Thuoc, không xóa dữ liệu liên quan.
Các FK hiện có không đặt ON DELETE CASCADE.

Service commit sau khi toàn bộ thao tác thành công. Lỗi nghiệp vụ/database được
rollback. Khi danh mục bị xóa sau bước kiểm tra hoặc có tranh chấp tham chiếu,
PostgreSQL FK vẫn bảo vệ dữ liệu và SQLSTATE 23503 được chuyển thành HTTP 409.
Không trả SQL, traceback, credentials hoặc nội dung exception cho client.

| HTTP | code | Ý nghĩa |
| --- | --- | --- |
| 400 | INVALID_REQUEST | Validation dữ liệu, JSON hoặc query thất bại |
| 401 | UNAUTHENTICATED | Chưa đăng nhập/session không hợp lệ/tài khoản không tồn tại |
| 403 | FORBIDDEN | Sai vai trò |
| 403 | ACCOUNT_LOCKED | Tài khoản bị khóa |
| 403 | CSRF_FAILED | Thiếu/sai CSRF hoặc Origin không được phép |
| 404 | PRODUCT_NOT_FOUND | Thuốc không tồn tại khi GET chi tiết/PUT/DELETE |
| 404 | CATEGORY_NOT_FOUND | Danh mục của POST/PUT không tồn tại |
| 409 | PRODUCT_IN_USE | Thuốc đang được tham chiếu khi DELETE |
| 409 | FOREIGN_KEY_CONFLICT | Lỗi FK khi tạo/cập nhật, kể cả tranh chấp đồng thời |
| 415 | JSON_REQUIRED | POST/PUT không gửi Content-Type JSON |
| 503 | DATABASE_UNAVAILABLE | Lỗi SQLAlchemy/database còn lại |

## Postman

Chỉ thao tác ghi trên database thử nghiệm được cho phép. Các bước dưới đây chưa
được chạy với database thật trong quá trình triển khai.

1. Chạy Backend và auth theo [Module 01](MODULE_01_AUTH.md). Đặt biến Postman
   `base_url` theo server, ví dụ `http://localhost:5000` ở development. Giữ cùng
   hostname trong mọi request để cookie jar hoạt động. Cookie Secure cần HTTPS;
   HTTP local cần cấu hình phát triển tương ứng Module 01.
2. GET `{{base_url}}/api/auth/me`; lấy csrf_token kể cả response 401. Lưu cookie
   lanyen_session do Postman nhận. POST `/api/auth/otp/request` với phone của tài
   khoản quản lý hiện có và header `X-CSRF-Token: {{csrf_token}}`. Xác minh bằng
   POST `/api/auth/otp/verify` theo Module 01. Lưu csrf_token mới sau đăng nhập.
   Có thể đặt Post-response script ở /me và /otp/verify:

   ```javascript
   const body = pm.response.json();
   if (body.csrf_token) pm.environment.set('csrf_token', body.csrf_token);
   ```

3. GET `{{base_url}}/api/manager/categories` lấy ID danh mục thử nghiệm hiện có.
4. POST `{{base_url}}/api/manager/products` với body JSON ví dụ phía trên, ID danh
   mục hợp lệ, Content-Type application/json và header X-CSRF-Token. Mong đợi
   201; lưu `product.MaThuoc` vào biến product_id. Bỏ PhanLoai để kiểm tra mặc
   định false; thử boolean true ở lần tạo khác.
5. GET `{{base_url}}/api/manager/products/{{product_id}}`: mong đợi 200 và đủ trường.
   GET danh sách với search lần lượt khớp tên, mã dược, số đăng ký. Thử category_id,
   phan_loai, page, per_page, sort_by và sort_order theo bảng tham số.
6. PUT cùng URL chi tiết, gửi đầy đủ trường bắt buộc và tên mới. Thử truyền
   PhanLoai=true; bỏ PhanLoai ở lần PUT sau để kiểm tra giữ nguyên true.
7. Thử bỏ từng trường bắt buộc, chuỗi quá dài, URL HTTP, NguongTonKho=true/-1/1.5,
   PhanLoai="true", thêm MaThuoc hoặc GhiChu: mong đợi 400. Danh mục không tồn
   tại ở POST/PUT trả 404. Không tạo thuốc hay danh mục giả ngoài môi trường test.
8. DELETE thuốc vừa tạo chưa có tham chiếu: mong đợi 200; GET lại trả 404.
   Với thuốc đã có tham chiếu trong dữ liệu thử nghiệm sẵn có, DELETE trả 409
   PRODUCT_IN_USE và dữ liệu được giữ nguyên. Không cần tạo đơn giá/lô/đơn hàng
   để kiểm thử module này; trường hợp tham chiếu đã có unit tests mock.
9. Bỏ/sửa X-CSRF-Token khi ghi: 403. Xóa cookie session: 401. Đăng nhập tài khoản
   khách/nhân viên: cả năm API đều 403. Tài khoản bị khóa bị từ chối ở backend.

## Kiểm thử và tệp thay đổi

Chạy từ thư mục gốc:

```powershell
$env:PYTHONPATH = 'backend'
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_products.py -v
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_*.py -v
```

Tests thuốc mock repository thuốc, danh mục và người dùng. Engine.connect bị
chặn để kết nối PostgreSQL ngoài ý muốn gây lỗi test ngay. Tests repository mock
session và biên dịch SQL theo dialect PostgreSQL; không thực thi SQL thật.
Có kiểm tra đủ các bảng tham chiếu bằng cách đối chiếu metadata hiện có.
Kết quả đã chạy: 34/34 tests thuốc đạt; chạy hồi quy toàn bộ Backend đạt 81/81
(34 thuốc + 21 danh mục + 26 auth). Imports và khởi tạo Flask được kiểm chứng
trong tests; `git diff --check` không có lỗi whitespace.
Chưa kiểm thử tích hợp PostgreSQL thật, khóa đồng thời thực tế hoặc Postman thật.

- Sửa backend/app/__init__.py: đăng ký blueprint products.
- Tạo backend/app/routes/product_routes.py.
- Tạo backend/app/controllers/product_controller.py.
- Tạo backend/app/services/product_service.py.
- Tạo backend/app/repositories/thuoc_repository.py.
- Tạo backend/app/schemas/product_schema.py.
- Tạo backend/tests/test_products.py.
- Tạo docs/MODULE_02_2_PRODUCTS.md.

Không thay đổi dữ liệu PostgreSQL thật trong quá trình kiểm thử. Không sửa models,
15 bảng, migration, Frontend, .env hoặc dependencies; không tạo/chạy migration.
