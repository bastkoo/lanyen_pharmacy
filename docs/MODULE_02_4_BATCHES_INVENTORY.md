# Module 02.4 — Lô thuốc và tồn kho

Backend theo model LoThuoc hiện tại, không sửa model, schema 15 bảng, migration,
Frontend hoặc dữ liệu PostgreSQL thật. Không tạo bảng lịch sử, nghiệp vụ bán
hàng, nhập bổ sung, kiểm kê, điều chỉnh tồn hoặc Cloudinary.

Tái sử dụng session, require_roles(2), csrf_protect, kiểm tra thuốc tồn tại,
payload JSON và xử lý lỗi/rollback database của Module 02.2. Tái sử dụng schema
phân trang Module 02.3. Mọi endpoint chỉ dành cho quản lý, kiểm tra lại trạng thái
tài khoản trên mỗi request. TrangThai=True là bị khóa. POST/PUT/DELETE cần CSRF.
Responses dùng Cache-Control: no-store và X-Content-Type-Options: nosniff.

## Endpoint

| Method | Endpoint | Thành công / giới hạn |
| --- | --- | --- |
| GET | /api/manager/products/{product_id}/batches | 200, BATCHES_LISTED, items + phân trang |
| GET | /api/manager/products/{product_id}/batches/{batch_id} | 200, BATCH_FOUND, batch |
| POST | /api/manager/products/{product_id}/batches | 201, BATCH_CREATED, batch |
| PUT | /api/manager/products/{product_id}/batches/{batch_id} | 200, BATCH_UPDATED, batch |
| DELETE | /api/manager/products/{product_id}/batches/{batch_id} | 409, BATCH_DELETE_UNSAFE với lô tồn tại thuộc thuốc |
| GET | /api/manager/inventory/summary | 200, INVENTORY_SUMMARY |
| GET | /api/manager/inventory/expiring | 200, EXPIRING_BATCHES_LISTED hoặc EXPIRED_BATCHES_LISTED |
| GET | /api/manager/inventory/low-stock | 200, LOW_STOCK_LISTED |

Mọi danh sách hỗ trợ page mặc định 1 (1–2147483647), per_page mặc định 20 (1–100).
Response gồm items, page, per_page, total, pages. Không có kết quả: items=[],
total=0, pages=0. Trang vượt kết quả trả items=[]. Không nhận tham số lạ/lặp lại.

## Tạo và cập nhật lô

POST nhận đủ các trường sau:

```json
{
  "SoLoSanXuat": "TEST-LOT-024",
  "NgaySanXuat": "2026-01-01",
  "HanSuDung": "2027-01-01",
  "SoLuongNhap": 100,
  "GiaNhap": 500
}
```

- MaThuoc lấy từ URL, phải tồn tại. Không nhận MaThuoc hoặc MaLo trong body.
- SoLoSanXuat trim đầu/cuối, dài 1–100 ký tự; từ chối null, sai kiểu, NUL và
  toàn khoảng trắng. Không yêu cầu số lô duy nhất toàn hệ thống.
- Ngày bắt buộc đúng YYYY-MM-DD và là ngày lịch hợp lệ, HanSuDung > NgaySanXuat.
  Không tự áp đặt quy tắc ngày sản xuất/hạn dùng so với ngày hiện tại khi tạo.
- SoLuongNhap là integer JSON 1–2147483647; GiaNhap 0–2147483647, theo Integer
  PostgreSQL. Không nhận boolean, float, chuỗi số hoặc null thay integer.
- Server tự tạo SoLuongTon=SoLuongNhap. Body có SoLuongTon bị từ chối, kể cả khi
  bằng số lượng nhập. Không nhận trường ngoài schema.

Response batch có đúng tám trường model; ngày được serialize YYYY-MM-DD.

PUT yêu cầu SoLoSanXuat, NgaySanXuat, HanSuDung, GiaNhap đầy đủ. SoLuongNhap có
thể bỏ qua; nếu gửi phải bằng giá trị hiện tại, không thay đổi trường này. Bất kỳ
thay đổi SoLuongNhap nào trả 409 BATCH_QUANTITY_IMMUTABLE, dù tồn còn bằng nhập.
Không nhận SoLuongTon. Repository chỉ gán bốn trường thông tin lô, không gán
MaLo, MaThuoc hoặc hai trường số lượng. Khóa dòng lô trong transaction trước khi
kiểm tra/cập nhật; commit sau thành công, rollback lỗi.

Nếu dữ liệu hiện hữu có SoLuongTon < 0 hoặc SoLuongTon > SoLuongNhap, PUT trả
409 BATCH_STOCK_INCONSISTENT. Module này không tự sửa dữ liệu bất nhất.

## Giới hạn an toàn cập nhật và xóa

Schema không có lịch sử xuất/nhập theo từng lô và đơn hàng không tham chiếu MaLo.
Chỉ dựa vào SoLuongNhap và SoLuongTon không đủ chứng minh lô chưa từng phát sinh
xuất kho. Vì vậy không thay đổi lượng nhập và không kích hoạt xóa lô. Repository
không có hàm DELETE lô; DELETE endpoint chỉ kiểm tra thuốc/lô rồi trả lỗi nghiệp vụ
409 BATCH_DELETE_UNSAFE. Không khôi phục tồn bằng cách xóa, không cascade.

Đây là giới hạn thực hiện đúng yêu cầu Module 02.4, không phải thiếu xử lý một
đường dẫn. Không thêm audit table hoặc tự suy ra lịch sử. BATCH_NOT_FOUND trả 404
cho ID không tồn tại/không thuộc thuốc; PRODUCT_NOT_FOUND trả 404 khi thuốc không
tồn tại. Cả SELECT và khóa dòng lô đều ràng buộc MaLo cùng MaThuoc.

## Tổng hợp tồn kho

Summary trả mỗi thuốc:

```json
{
  "MaThuoc": 3,
  "TenThuoc": "Thuốc kiểm thử",
  "TongSoLuongTon": 150,
  "NguongTonKho": 20,
  "TonKhoThap": false
}
```

TongSoLuongTon = SUM(LoThuoc.SoLuongTon) theo thuốc, tính theo đơn vị nhỏ nhất.
LEFT JOIN với Thuoc và COALESCE về 0 để bao gồm thuốc chưa có lô. Không join đơn
vị giá/quy đổi làm nhân số lượng. Tổng này là tồn vật lý từ tất cả lô, kể cả lô
đã hết hạn; không phải số lượng có thể bán. Không tự loại lô hết hạn khỏi tổng
vì yêu cầu chỉ định tổng SoLuongTon. Sắp theo MaThuoc tăng dần.

Low-stock dùng cùng truy vấn, lọc TongSoLuongTon <= NguongTonKho. Bao gồm thuốc
chưa có lô với tổng 0 nếu thỏa ngưỡng. Không clamp hoặc tự điều chỉnh tồn hiện có.

## Lô sắp hết hạn và đã hết hạn

```text
GET /api/manager/inventory/expiring?days=30&status=expiring&page=1&per_page=20
GET /api/manager/inventory/expiring?status=expired
```

- days mặc định 30; integer query từ 0–36500 (giới hạn cửa sổ truy vấn 100 năm).
- status mặc định expiring: chỉ lô còn SoLuongTon > 0, HanSuDung >= hôm nay và
  <= hôm nay + days. Không đưa lô đã hết hạn vào danh sách này.
- status=expired: chỉ lô còn tồn, HanSuDung < hôm nay, không giới hạn số ngày đã
  hết hạn; days không ảnh hưởng tập kết quả khi dùng trạng thái này.
- Ngày hiện tại tính theo UTC+7 (Asia/Saigon), không phụ thuộc timezone máy chủ.
  Hạn sử dụng đúng hôm nay được tính còn hạn đến hết ngày. days=0 xem lô hết hạn
  vào hôm nay. Hai đầu cửa sổ sắp hết hạn được tính bao gồm.
- Mỗi item trả đủ trường batch, thêm TenThuoc và TrangThaiHan=EXPIRING/EXPIRED.
  Metadata có as_of (YYYY-MM-DD), days, status cùng phân trang.
- Sắp theo HanSuDung rồi MaLo tăng dần. Loại lô hết tồn khỏi cả hai trạng thái.

## Lỗi

| HTTP | code | Ý nghĩa |
| --- | --- | --- |
| 400 | INVALID_REQUEST | JSON, validation hoặc query sai |
| 401 | UNAUTHENTICATED | Chưa đăng nhập/session sai/tài khoản không tồn tại |
| 403 | FORBIDDEN / ACCOUNT_LOCKED / CSRF_FAILED | Sai quyền, bị khóa hoặc sai CSRF/Origin |
| 404 | PRODUCT_NOT_FOUND / BATCH_NOT_FOUND | Thuốc/lô không tồn tại hoặc lô thuộc thuốc khác |
| 409 | BATCH_QUANTITY_IMMUTABLE | Đề nghị thay đổi lượng nhập không thể xác minh an toàn |
| 409 | BATCH_STOCK_INCONSISTENT | Dữ liệu số lượng hiện hữu không nhất quán |
| 409 | BATCH_DELETE_UNSAFE | Không thể xác minh an toàn xóa lô |
| 409 | FOREIGN_KEY_CONFLICT | Lỗi FK, kể cả thuốc bị xóa đồng thời sau pre-check |
| 415 | JSON_REQUIRED | POST/PUT không dùng Content-Type JSON |
| 503 | DATABASE_UNAVAILABLE | Lỗi database được rollback và che thông tin nội bộ |

Không trả SQL, traceback hoặc credentials. Không sửa API các module cũ.

## Postman

Chỉ thực hiện ghi trên database thử nghiệm được cho phép. Không chạy các bước
ghi dưới đây trên dữ liệu thật chỉ để kiểm thử, vì module không hỗ trợ xóa lô.

1. Chạy Backend theo [Module 01](MODULE_01_AUTH.md). Dùng cùng hostname và cookie
   jar Postman. HTTP development cần cấu hình cookie phù hợp, cookie Secure cần HTTPS.
2. GET /api/auth/me lấy csrf_token (kể cả 401), giữ cookie lanyen_session. Đăng
   nhập tài khoản VaiTro=2, TrangThai=False qua otp/request và otp/verify theo
   Module 01. POST auth gửi X-CSRF-Token; sau đăng nhập lưu token mới được xoay.
3. GET /api/manager/products lấy ID thuốc thử nghiệm. Đặt product_id trong URL.
4. POST /api/manager/products/{product_id}/batches với JSON mẫu và header
   Content-Type: application/json, X-CSRF-Token: <token mới>. Mong đợi 201;
   kiểm tra batch.SoLuongTon bằng batch.SoLuongNhap. Lưu MaLo làm batch_id.
5. GET danh sách/chi tiết; PUT đủ bốn trường thông tin lô, bỏ SoLuongNhap. Mong
   đợi 200, hai trường số lượng không đổi. Đổi SoLuongNhap để nhận 409; truyền
   SoLuongTon/MaLo/MaThuoc để nhận 400.
6. DELETE lô hiện hữu: mong đợi 409 BATCH_DELETE_UNSAFE, dữ liệu giữ nguyên.
   Đổi product_id sang thuốc khác có thật: GET/PUT/DELETE trả 404 BATCH_NOT_FOUND.
7. GET summary và low-stock, đối chiếu tổng các lô cùng thuốc trong dữ liệu test.
   Thuốc không có lô trả tổng 0. Ngưỡng bằng tồn vẫn cảnh báo thấp.
8. GET expiring?days=30, sau đó ?status=expired. Đối chiếu as_of trong response;
   chỉ lô còn tồn xuất hiện, hai danh sách không lẫn lô đã hết hạn/sắp hết hạn.
   Dùng ngày thử nghiệm theo as_of để kiểm tra biên hôm nay và hôm nay+days.
9. Thử ngày sai, hạn bằng/trước ngày sản xuất, SoLuongNhap=0/-1/true, GiaNhap=-1,
   thiếu trường: nhận 400. Bỏ cookie: 401; sai vai trò: 403; bỏ/sai CSRF khi ghi: 403.

## Kiểm thử và giới hạn xác minh

```powershell
$env:PYTHONPATH = 'backend'
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_batches_inventory.py -v
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_*.py
```

Tests API/service mock repositories và chặn Engine.connect. Tests repository
mock session, kiểm tra/biên dịch SQL theo dialect PostgreSQL, không thực thi SQL.
Các trường hợp aggregate nhiều lô/thuốc không có lô được kiểm tra qua SQL SUM,
GROUP BY, LEFT JOIN, COALESCE và dữ liệu kết quả mock. Chưa kiểm chứng việc chạy
aggregate hoặc khóa đồng thời trên PostgreSQL thật; chưa chạy Postman thực tế.

Kết quả thực thi: 39/39 bài Module 02.4 đạt; hồi quy Backend đạt 145/145
(39 lô/tồn kho + 25 đơn vị giá + 34 thuốc + 21 danh mục + 26 auth).
Đã kiểm tra khởi tạo Flask/import qua tests và `git diff --check` không có lỗi
whitespace. Không phát hiện lỗi trong phạm vi đã rà soát; giới hạn PostgreSQL
thật và lịch sử xuất kho vẫn áp dụng như mô tả trên.

## Tệp thay đổi

- Sửa backend/app/__init__.py: đăng ký blueprint batches và inventory.
- Tạo backend/app/routes/batch_routes.py.
- Tạo backend/app/controllers/batch_controller.py.
- Tạo backend/app/schemas/batch_schema.py.
- Tạo backend/app/services/batch_service.py.
- Tạo backend/app/services/inventory_service.py.
- Tạo backend/app/repositories/lo_thuoc_repository.py.
- Tạo backend/app/repositories/inventory_repository.py.
- Tạo backend/tests/test_batches_inventory.py.
- Tạo docs/MODULE_02_4_BATCHES_INVENTORY.md.

Không sửa CSDL, model, migration, Frontend, .env hoặc dependencies. Không tạo/
chạy migration, không thêm dữ liệu giả vào PostgreSQL thật trong quá trình làm.
