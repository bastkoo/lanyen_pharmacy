# Module 02.7.2 — Backend chi tiết khuyến mãi

## Model và quyết định đã làm rõ

Model thực tế `ChiTietKhuyenMai` có đúng năm trường:

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| MaChuongTrinh | Integer, PK + FK | Khóa ngoại chương trình |
| MaThuoc | Integer, PK + FK | Khóa ngoại thuốc |
| LoaiGiamGia | Boolean, NOT NULL | false = giảm tiền trực tiếp; true = giảm phần trăm |
| GiaTriGiam | Numeric(12,2), NOT NULL | Mức giảm tiền hoặc phần trăm, tùy LoaiGiamGia |
| SoLuong | Integer, NOT NULL | Số sản phẩm còn được hưởng khuyến mãi |

Khóa chính kép `(MaChuongTrinh, MaThuoc)` đã bảo vệ tính duy nhất. Không có `MaCTKM`, `PhanTramGiam` hoặc `DieuKien`. Không thêm các trường này, không lưu điều kiện văn bản vào cột khác.

Người dùng đã làm rõ: hỗ trợ cả giảm tiền và phần trăm; số lượng là phần còn áp dụng, khi bán sẽ giảm đến 0 rồi ngừng áp dụng/hiển thị hết số lượng khuyến mãi. Trong bước Backend CRUD hiện tại, quản lý khởi tạo SoLuong khi gán thuốc. PUT chỉ sửa loại/mức giảm, không thay khóa hoặc nạp lại số lượng còn lại. GET dành cho quản lý vẫn trả bản ghi SoLuong=0 để theo dõi.

**Tự trừ SoLuong khi mua, ngừng áp dụng trong luồng mua hàng và hiển thị hết số lượng chưa được triển khai** vì bước này không làm giỏ hàng/đơn hàng/Frontend. Không giảm tồn kho vật lý, tự tạo giao dịch, cộng dồn hoặc chọn chương trình tốt nhất.

## API

Tiền tố: `/api/manager/promotions/<promotion_id>/items`.

Định danh cuối URL là **MaThuoc**, không phải một mã chi tiết mới. Chương trình nằm trong URL và không được gửi trong body.

| Method | Path | Thành công |
| --- | --- | --- |
| GET | tiền tố | 200 PROMOTION_ITEMS_LISTED + items/page/per_page/total/pages |
| POST | tiền tố | 201 PROMOTION_ITEM_CREATED + item |
| GET | tiền tố + `/<product_id>` | 200 PROMOTION_ITEM_FOUND + item |
| PUT | tiền tố + `/<product_id>` | 200 PROMOTION_ITEM_UPDATED + item |
| DELETE | tiền tố + `/<product_id>` | 200 PROMOTION_ITEM_DELETED |

Danh sách dùng page mặc định 1, phạm vi 1–2147483647, per_page mặc định 20, phạm vi 1–100; sắp theo MaThuoc tăng dần. Từ chối tham số lạ/lặp lại. Rỗng trả items=[], total=0, pages=0. Không tự lọc bản ghi hết số lượng khỏi danh sách quản lý.

### Tạo giảm tiền trực tiếp

POST `/api/manager/promotions/7/items`:

```json
{
  "MaThuoc": 3,
  "LoaiGiamGia": false,
  "GiaTriGiam": 25000.50,
  "SoLuong": 100
}
```

Response HTTP 201:

```json
{
  "code": "PROMOTION_ITEM_CREATED",
  "item": {
    "MaChuongTrinh": 7,
    "MaThuoc": 3,
    "LoaiGiamGia": false,
    "GiaTriGiam": "25000.50",
    "SoLuong": 100
  }
}
```

### Sửa sang giảm phần trăm

PUT `/api/manager/promotions/7/items/3`:

```json
{
  "LoaiGiamGia": true,
  "GiaTriGiam": 15
}
```

Response (nếu số lượng hiện tại còn 100):

```json
{
  "code": "PROMOTION_ITEM_UPDATED",
  "item": {
    "MaChuongTrinh": 7,
    "MaThuoc": 3,
    "LoaiGiamGia": true,
    "GiaTriGiam": "15.00",
    "SoLuong": 100
  }
}
```

Có thể tạo giảm phần trăm ngay từ POST bằng LoaiGiamGia=true, GiaTriGiam nguyên 1–100 và đủ MaThuoc/SoLuong. Khi chuyển ngược sang giảm tiền, PUT dùng false và số tiền hợp lệ. Không so sánh mức tiền giảm với đơn vị giá cụ thể vì model không chỉ định MaDonGia và bước này chưa tính giá.

GET chi tiết trả `PROMOTION_ITEM_FOUND` cùng object item năm trường. GET danh sách trả:

```json
{
  "code": "PROMOTION_ITEMS_LISTED",
  "items": [],
  "page": 1,
  "per_page": 20,
  "total": 0,
  "pages": 0
}
```

DELETE `/api/manager/promotions/7/items/3` trả `{"code":"PROMOTION_ITEM_DELETED"}`. Chỉ xóa cặp khóa tương ứng trong ChiTietKhuyenMai; không xóa chương trình, thuốc hoặc đơn vị giá.

## Validation

- LoaiGiamGia bắt buộc là JSON boolean; không nhận 0/1 hoặc chuỗi boolean.
- GiaTriGiam input bắt buộc JSON number, không nhận boolean, chuỗi số, NaN/Infinity hoặc null.
- Giảm phần trăm: JSON integer 1–100; từ chối float kể cả 10.0.
- Giảm tiền trực tiếp: số không âm, tối đa 9999999999.99 theo Numeric(12,2); không nhận giá trị có phần lẻ vượt độ chính xác hai chữ số. Kiểm tra trước bước Decimal quantize để không âm thầm làm tròn 1.005 thành 1.00/1.01.
- GiaTriGiam response là chuỗi Decimal với hai chữ số lẻ, tránh chuyển số tiền sang float khi serialize. Đây là kiểu output của trường Numeric, không phải field mới.
- POST: MaThuoc integer 1–2147483647; SoLuong integer 0–2147483647. Không nhận float, boolean hoặc chuỗi số. Cho phép 0 để thể hiện không còn số lượng áp dụng.
- PUT yêu cầu đủ LoaiGiamGia và GiaTriGiam; từ chối MaThuoc, MaChuongTrinh, SoLuong và tất cả trường ngoài schema. Thay mức giảm không làm số lượng đã về 0 tăng lại.
- Không nhận điều kiện văn bản vì model không có cột tương ứng.

## Transaction, quyền và bảo vệ dữ liệu

Dùng promotion blueprint/error handler/cache headers hiện có, `PromotionError`, session, require_roles(2) và csrf_protect. Controller chương trình chỉ được mở rộng helper payload/query để chia sẻ validation; contract CRUD chương trình giữ nguyên.

Mọi thao tác kiểm tra chương trình tồn tại; POST kiểm tra thuốc tồn tại và kiểm tra cặp khóa trùng. PostgreSQL PK tiếp tục bảo vệ tranh chấp tạo đồng thời, SQLSTATE 23505 trả PROMOTION_ITEM_EXISTS. Thuốc có thể thuộc nhiều chương trình, không áp quy tắc trùng tên/khoảng thời gian hoặc cộng dồn giảm giá.

GET/PUT/DELETE đều scope bằng cả hai khóa. PUT/DELETE khóa dòng chi tiết; repository update chỉ gán LoaiGiamGia và GiaTriGiam. DELETE là SQLAlchemy Core DELETE trên ChiTietKhuyenMai theo cả hai khóa, không cascade. Commit sau thành công; rollback khi lỗi nghiệp vụ, FK/unique, lỗi database hoặc commit. Không có truy vấn ghi vào Thuoc, DonVi_GiaThuoc, ChuongTrinhKhuyenMai, GioThuoc hoặc DonHang.

Tài khoản khách/nhân viên bị từ chối; mỗi request đọc lại vai trò và trạng thái từ database qua guard hiện có. POST/PUT/DELETE yêu cầu X-CSRF-Token và Origin hợp lệ nếu gửi Origin. Không thêm bypass hoặc token flow mới.

| HTTP | code | Ý nghĩa |
| --- | --- | --- |
| 400 | INVALID_REQUEST | Body/query/trường không hợp lệ |
| 401 | UNAUTHENTICATED | Chưa đăng nhập hoặc tài khoản không tồn tại |
| 403 | FORBIDDEN / ACCOUNT_LOCKED / CSRF_FAILED | Sai quyền, tài khoản khóa hoặc lỗi CSRF/Origin |
| 404 | PROMOTION_NOT_FOUND | Chương trình không tồn tại |
| 404 | PRODUCT_NOT_FOUND | Thuốc cần gán không tồn tại |
| 404 | PROMOTION_ITEM_NOT_FOUND | Không có cặp khóa hoặc chi tiết thuộc chương trình khác |
| 409 | PROMOTION_ITEM_EXISTS | Thuốc đã được gán vào chương trình này |
| 409 | FOREIGN_KEY_CONFLICT | Dữ liệu cha thay đổi đồng thời, FK từ chối ghi |
| 415 | JSON_REQUIRED | POST/PUT không dùng JSON |
| 503 | DATABASE_UNAVAILABLE | Lỗi database, không trả SQL/traceback/credentials |

## File tạo

- `backend/app/schemas/promotion_item_schema.py`
- `backend/app/repositories/chi_tiet_khuyen_mai_repository.py`
- `backend/app/services/promotion_item_service.py`
- `backend/app/controllers/promotion_item_controller.py`
- `backend/tests/test_promotion_items.py`
- `docs/MODULE_02_7_2_PROMOTION_ITEMS.md`

## File sửa

- `backend/app/routes/promotion_routes.py` — đăng ký năm route con trong blueprint hiện có.
- `backend/app/controllers/promotion_controller.py` — chia sẻ helper JSON và pagination, giữ nguyên response chương trình.

Không sửa model, PostgreSQL schema, migration, dependencies, Frontend hoặc dữ liệu thật. File `backend/app/models.zip` có sẵn trong workspace được giữ nguyên, không thuộc thay đổi module.

## Kiểm thử và giới hạn

Từ backend:

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -p test_promotion_items.py -v
.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
```

30/30 bài riêng và hồi quy toàn Backend 249/249 bài đã đạt: list/detail/create/update/delete, hai loại giảm, phần trăm nguyên và biên 0/100/101, tiền thập phân và giới hạn Numeric, từ chối làm tròn/dữ liệu sai kiểu, SoLuong=0/giới hạn/readonly khi PUT, chương trình/thuốc không tồn tại, trùng cặp, một thuốc ở nhiều chương trình, scope cặp khóa/khóa dòng, DELETE không cascade, whitelist update, PK/FK metadata, 401/403/khóa tài khoản/CSRF, rollback và che lỗi database. Không có trường ngày trong chi tiết; các validation ngày chương trình tiếp tục do Module 02.7.1 xử lý.

Tests API/service mock repositories và chặn Engine.connect; tests repository mock session và biên dịch SQL PostgreSQL. Không thực thi SQL trên database thật. Chưa kiểm thử CRUD/Postman hoặc tranh chấp đồng thời PostgreSQL thật. Không kiểm thử mua hàng, tự trừ số lượng, giá thanh toán hoặc hiển thị hết số lượng vì các chức năng này nằm ngoài bước hiện tại.

Bộ hồi quy phát một số ResourceWarning về file tạm chưa đóng/được dọn ngầm, không có bài thất bại. Chưa điều tra/sửa các cảnh báo ngoài phạm vi module. `git diff --check` không phát hiện lỗi whitespace; import/khởi tạo Flask đã được kiểm tra trong tests.

Sau bàn giao dừng ở Backend quản lý chi tiết khuyến mãi, không tự triển khai bước tiếp theo.
