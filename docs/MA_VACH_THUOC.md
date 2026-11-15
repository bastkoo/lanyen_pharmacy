# Đồng bộ mã vạch thuốc

## Cột PostgreSQL đã xác minh

Người dùng đã thêm thủ công `Thuoc.MaVach`. Đã đọc metadata trực tiếp trên PostgreSQL:

- VARCHAR(255), NOT NULL, không default.
- Không unique constraint hoặc index trên MaVach.
- SQLAlchemy model được bổ sung `db.String(255), nullable=False` cho đúng database.

Không chạy ALTER TABLE, tạo/chạy migration, sửa constraint/index hoặc cập nhật dữ liệu hiện có. Migration gốc chưa có MaVach; khi dựng database mới chỉ từ migration cũ, cần xử lý đồng bộ schema theo một bước migration riêng được duyệt. Không tự điền mã giả để backfill trường bắt buộc.

## API và validation

GET danh sách/chi tiết thuốc trả thêm MaVach. POST/PUT thuốc nhận MaVach là chuỗi bắt buộc, trim đầu/cuối, 1–255 Unicode code points, không NUL. Không nhận số, boolean hoặc null; giữ số 0 ở đầu. Không áp chuẩn EAN/UPC, checksum hoặc tính duy nhất khi chưa có quy tắc này.

Ví dụ phần mã nhận diện trong JSON tạo/sửa thuốc (vẫn cần đủ các trường khác của ProductSchema):

```json
{
  "MaDuoc": "MD-001",
  "MaVach": "0012345678901",
  "SoDangKy": "SDK-001"
}
```

`GET /api/manager/products?search=0012345678901` tìm cả MaVach bằng truy vấn tham số hóa; giữ nguyên tìm tên/mã dược/số đăng ký. `sort_by=MaVach` được cho phép. Không đổi đường dẫn hoặc cơ chế session/CSRF.

API inventory summary, low-stock và expiring/expired trả thêm MaVach từ Thuoc, không join thêm bảng làm nhân số lượng. Không đổi cách tính tổng tồn, ngưỡng hoặc hạn dùng.

## Giao diện được cập nhật

- Quản lý thuốc: trường Mã vạch trong thêm/sửa và chi tiết, hiển thị tại cột mã nhận diện; tìm kiếm và sắp xếp mã vạch.
- Đơn vị tính/giá bán: mã vạch ở danh sách chọn thuốc và thông tin thuốc đang chọn; tìm qua API thuốc.
- Lô thuốc: mã vạch trong option chọn thuốc và thông tin thuốc đang chọn; tìm qua API thuốc.
- Tồn kho: mã vạch dưới tên thuốc trong tổng hợp, tồn thấp và hạn sử dụng; lọc tên/mã vạch trong trang hiện tại.
- Khuyến mãi: mã vạch tại option chọn thuốc, thuốc trong chương trình và dialog sửa; tìm qua API thuốc và lọc tên/mã vạch trong trang chi tiết hiện tại.
- Dashboard: mã vạch trong cảnh báo thuốc tồn thấp và lô sắp hết hạn.

Nội dung hiển thị dùng textContent/Option, không chèn HTML. Không tạo barcode dạng hình, tính giá, sửa tồn kho hoặc thêm thư viện quét mã. Các trang khách hàng hiện chưa có danh sách thuốc nối API trong phạm vi này nên không tạo chức năng mới.

Sau cập nhật, khởi động lại Flask nếu server không tự reload; tải lại trang Manager bằng Ctrl+Shift+R để tránh JavaScript cũ. Vào #products để thêm/sửa mã vạch. Nếu dùng Postman/client cũ, bổ sung MaVach vào body POST/PUT thuốc.

## File

Backend: `app/models/thuoc.py`, `app/schemas/product_schema.py`, `app/repositories/thuoc_repository.py`, `app/schemas/batch_schema.py`, `app/repositories/inventory_repository.py`.

Frontend: `js/utils/product-validation.js`; sáu controller trang `manager-products.js`, `manager-units.js`, `manager-batches.js`, `manager-inventory.js`, `manager-promotions.js`, `manager-dashboard.js`; `pages/manager/index.html`.

Tests: cập nhật `test_products.py`, `test_batches_inventory.py`, `test_products_frontend.mjs` và fixture/checks trình duyệt products/units/stock/promotions. Tạo `backend/tests/check_barcode_live.py`. Cập nhật tài liệu API thuốc, frontend thuốc và ảnh QA chi tiết/form khuyến mãi liên quan.

## Kiểm chứng

- 252/252 bài Backend đạt, gồm kiểm tra trường bắt buộc/type/độ dài, roundtrip giữ 0 đầu, không áp unique, SQL search MaVach và metadata model, MaVach trong tồn/hạn dùng.
- 32/32 bài frontend đạt, gồm validation barcode không mất số 0 đầu.
- Chrome headless hồi quy đầy đủ Manager/Dashboard/danh mục/thuốc/đơn vị giá/lô/tồn kho/khuyến mãi đạt; thêm kiểm tra hiển thị mã vạch và tìm thuốc theo mã vạch. Không tràn trang ở 1440/1280/1024/768/375/320px. Browser API/AUTH là mock, không ghi PostgreSQL.
- Script thật `backend/tests/check_barcode_live.py` chạy READ ONLY thành công: metadata/model khớp; danh sách/sort/search/chi tiết thuốc và 4 truy vấn tồn kho. Đối chiếu 11 thuốc và 21 dòng tồn kho với dữ liệu thật; không in mã vạch/dữ liệu người dùng ra log.
- Đã xem ảnh mobile bảng thuốc khuyến mãi sau bổ sung mã vạch. Kiểm tra imports/khởi tạo Flask qua tests và git diff --check.

Chưa kiểm thử tạo/sửa dữ liệu trên PostgreSQL thật hoặc browser nối Flask thật; không tự sửa dữ liệu thật để kiểm thử. Script chỉ đọc dùng Flask test client với session ký cho quản lý hiện có, không phải kiểm thử OTP. Hồi quy Backend còn ResourceWarning file tạm như các lần trước, không có test thất bại.
