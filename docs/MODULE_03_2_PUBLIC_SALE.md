# Module 03.2 — Ưu đãi công khai và giá khuyến mãi trong giỏ

## Phạm vi

Khung ưu đãi trên trang chủ nằm dưới banner và ngay trên danh mục. Dùng màu Green 1.0,
HTML/CSS/JavaScript hiện có; không thêm thư viện, bảng, cột hoặc migration.
Danh sách chương trình đang diễn ra và sắp tới sắp theo ngày bắt đầu, ngày kết thúc,
rồi ID tăng dần. Ngày tính theo Việt Nam, gồm cả ngày bắt đầu và kết thúc.
Dữ liệu chỉ có DATE: không tạo giờ hoặc đồng hồ đếm ngược giả.

Khung gồm bộ chọn chương trình cuộn ngang, tên/khoảng ngày/trạng thái, các thẻ thuốc
thu gọn và phân trang 10 sản phẩm. Mỗi thẻ có ảnh trong khung cố định, tên kèm quy cách,
đơn vị chia đều, giá gốc gạch ngang, giá giảm, số lượng ưu đãi còn và nút mua.
Chương trình sắp tới chỉ xem trước, nút `Sắp diễn ra` bị khóa.
Hết quota hiển thị `Hết ưu đãi`; thiếu tồn lô còn hạn hiển thị `Hết hàng`.
Có trạng thái tải/rỗng/lỗi/thử lại và hủy phản hồi cũ khi đổi chương trình.
Tải lại khi trở lại tab hoặc qua ngày để cập nhật trạng thái chương trình.

## Quy tắc người dùng xác nhận

- Mức giảm tiền và `SoLuong` đều tính theo đơn vị nhỏ nhất.
- Giảm phần trăm: tính số tiền giảm của đơn vị nhỏ nhất rồi nhân hệ số quy đổi
  của đơn vị đang chọn. Không áp phần trăm riêng vào giá gói lớn nếu giá các đơn vị khác tỷ lệ.
- Giảm tiền: nhân mức giảm với `SoLuongQuyDoi` rồi trừ vào giá bán hiện có của đơn vị.
- Giá đơn vị nhỏ nhất lấy từ đơn vị có hệ số quy đổi nhỏ nhất, quy về 1; nếu nhiều
  đơn vị cùng hệ số, lấy ID thấp nhất để kết quả ổn định. Không sửa giá niêm yết của đơn vị nào.
- Giá kết quả không âm; làm tròn giá cuối bằng Decimal ROUND_HALF_UP đến đồng.
- Số suất hiển thị cho đơn vị = phần nguyên của `min(quota còn, tồn khả dụng) / hệ số quy đổi`.
  Tồn khả dụng giữ quy tắc lô còn hạn/còn tồn hiện có. Không xuất thông tin lô hoặc giá nhập.
- Bấm Chọn mua dùng API giỏ hiện có, không nhận giá từ trình duyệt và không giữ/trừ quota.
  Quota chỉ trừ khi bán; luồng bán/đặt hàng chưa thuộc phạm vi này.
- Khi xem giỏ, máy chủ tự xét chương trình đang diễn ra có quota còn, chọn một
  chương trình làm tổng tiền dòng thấp nhất, không cộng dồn. Nếu quota chỉ đủ một phần,
  phần còn lại tính giá gốc và giao diện hiển thị riêng hai phần.
- Quota dùng chung giữa các dòng của cùng thuốc trong giỏ, theo thứ tự dòng hiện có;
  không tính một số lượng quota hai lần. Không sửa SoLuong trong CSDL khi chỉ xem giỏ.
- Giá/khuyến mãi trong giỏ được tính lại mỗi lần đọc theo dữ liệu hiện tại, không lưu
  mã chương trình hoặc giá cố định vào session/GioThuoc. Không tự chọn chương trình sắp tới/đã kết thúc.

Ví dụ viên giá 1.000đ, vỉ 10 viên giá 9.000đ, giảm 10%: tiền giảm theo viên là 100đ;
vỉ được giảm 1.000đ và còn 8.000đ. Nếu còn 15 viên quota, một vỉ dùng 10, còn 5 viên quota.

## API

| Method | Endpoint | Kết quả |
| --- | --- | --- |
| GET | `/api/promotions` | `PROMOTIONS_LISTED`, items, page/per_page/total/pages, as_of |
| GET | `/api/promotions/<id>/products` | `PROMOTION_PRODUCTS_LISTED`, promotion, items, page/per_page/total/pages, as_of |

Cả hai nhận page mặc định 1, per_page mặc định 12/tối đa 100, từ chối tham số lạ/lặp.
Không đăng nhập, không gửi cookie, GET-only và no-store. Dùng repository/model khuyến mãi hiện có;
API quản lý và quyền quản lý giữ nguyên. Chương trình đã kết thúc/không tồn tại trả 404.

Mỗi sản phẩm có `KhuyenMai` (ID, loại/mức giảm, số lượng theo đơn vị nhỏ nhất, trạng thái).
Mỗi đơn vị bổ sung `GiaKhuyenMai`, `SoLuongKhuyenMai` theo đơn vị đang bán.
Giá công khai vẫn dùng projection loại bỏ dữ liệu nội bộ.

GET `/api/cart` giữ các trường cũ. Khi có giảm giá, bổ sung `GiaGoc`, `SoLuongKhuyenMai`,
`KhuyenMai`; `GiaBan` là giá ưu đãi, `ThanhTien` gồm phần ưu đãi và phần giá gốc.
Khách và người đăng nhập dùng cùng phép tính; session/DB tiếp tục chỉ lưu thuốc, đơn vị và số lượng.

## File chính

- Backend: `public_promotion_service.py`, `sale_pricing.py`, các repository chương trình/chi tiết,
  `public_catalog_routes.py`, `public_catalog_controller.py`, `public_catalog_schema.py`.
- Dùng chung serialization công khai ở `product_service.py`; báo giá giỏ ở `cart_service.py`.
- Frontend: `home.html`, `public-sale.css`, `components/public-sale.js`, `api/public-catalog.js`;
  tái sử dụng `productCard` và `purchaseControls` trong `public-catalog.js` / `cart.js`.
- Test: `test_public_promotions.py`, ca báo giá giỏ trong `test_cart.py`, client công khai,
  `browser_sale.mjs` được chạy qua `browser_manager.mjs --homepage`.

Không tạo dữ liệu khuyến mãi mẫu trong PostgreSQL. Khi không có chương trình phù hợp,
khung hiển thị trạng thái rỗng; dữ liệu thật được quản lý ở trang quản lý khuyến mãi.

## Kiểm chứng

- 329 kiểm thử Python và 54 kiểm thử JavaScript đạt.
- `node backend/tests/browser_manager.mjs --homepage --promotions` đạt: sale hiện đúng vị trí,
  đang diễn ra/sắp tới, đổi đơn vị/giá/quota, thêm giỏ với giá giảm, hết ưu đãi/hết hàng,
  phân trang, lỗi/rỗng/thử lại, phản hồi cũ và không tràn ở 320–1440px. Quản lý khuyến mãi
  CRUD/quyền/CSRF và luồng xác thực cũ cũng đạt. Fixture không ghi CSDL; ảnh QA lưu thư mục tạm.
- Đã xem ảnh QA desktop/mobile, chỉnh tiêu đề trắng trên nền xanh để bảo đảm tương phản.
- PostgreSQL thật bắt buộc `default_transaction_read_only=on`: API trả một chương trình
  phù hợp và một đơn vị có giá sale tại thời điểm kiểm tra; phép tính giá được đối chiếu
  bằng Decimal độc lập. Thêm giỏ khách và báo giá dùng session test client riêng thành công.
  Không ghi CSDL, không sửa quota/tồn và không chạy migration.
- Chưa thử bán/đặt hàng hoặc trừ quota trên dữ liệu thật; phần đó chưa thuộc yêu cầu này.
