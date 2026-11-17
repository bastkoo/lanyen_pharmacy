# MODULE 03.11 — Đơn hàng của tôi

Trang `frontend/pages/customer/orders.html` dùng session khách hàng hiện tại. Bộ lọc:

| Query status | Nhãn | TrangThaiDonHang |
| --- | --- | --- |
| all | Tất cả | Tất cả |
| processing | Đang xử lý | 0, 1 |
| shipping | Đang giao | 2 |
| delivered | Đã giao | 3 |
| cancelled | Đã hủy | 4 |
| returns | Đổi trả | 5 |

Chỉ bộ lọc Đang xử lý hiển thị số lượng: tổng đơn 0/1 của khách hàng, độc lập với trang hoặc bộ lọc đang xem. Trạng thái 1 vẫn đang thực hiện, chưa hoàn tất xử lý.

## API chỉ đọc

`GET /api/orders?status=all&page=1&per_page=10`, role khách hàng 0. `page` từ 1 đến 2147483647; `per_page` từ 1 đến 50. Không nhận mã khách hàng do client chỉ định. Query lạ, bộ lọc sai hoặc tham số trùng trả 400.

Response `ORDERS_LISTED` gồm `items`, `total`, `processing_count`, `page`, `per_page`, `status`. Mỗi item gồm dữ liệu đơn hiện có và `NgayDat`, `HinhThucNhanHang`, `item_count`, `preview`, `can_pay`. Mã BIGINT và tiền giữ dạng chuỗi. Preview là dòng chi tiết đầu tiên; giá và tổng tiền dùng dữ liệu đã lưu, không áp giá bán mới. Danh mục chỉ cung cấp tên/ảnh/đơn vị. Truy vấn luôn giới hạn chủ đơn, sắp ngày đặt/mã giảm dần; preview được tải chung, không truy vấn từng đơn.

## Thanh toán

`can_pay=true` chỉ khi QR, TrangThaiThanhToan=0, TrangThaiDonHang=0 và đã xác định môi trường Gateway. Nút Thanh toán gọi API POST payment hiện có rồi tự submit form SePay đã kiểm tra bằng utility chung. Backend vẫn kiểm tra quyền sở hữu/trạng thái/môi trường khi khởi tạo. Đơn cũ chưa xác định môi trường không tự chuyển sang Gateway. Không tạo đơn mới, trừ kho lần nữa hoặc cập nhật thanh toán từ URL.

Trang có trạng thái tải/rỗng/lỗi/thử lại, URL bộ lọc, phân trang, liên kết chi tiết và xóa dữ liệu riêng khi đăng xuất. Không thêm chức năng hủy/mua lại. Không thay đổi model/schema/migration, COD hoặc luồng IPN.

## Kiểm thử

- Backend: `.venv/Scripts/python.exe -m unittest discover -s tests -p test_orders.py` từ thư mục backend: 52 tests qua, bao gồm bộ lọc, quyền sở hữu, role, query sai, điều kiện thanh toán, biên dịch SQL PostgreSQL và hồi quy COD/Gateway/IPN.
- JavaScript: `node --test backend/tests/test_checkout_frontend.mjs`: 4 tests qua.
- Chrome: `node backend/tests/browser_manager.mjs --checkout`: qua checkout/detail/orders, sáu bộ lọc, tổng đang xử lý, form thanh toán, DOM an toàn, lỗi/thử lại, rỗng/đăng xuất và responsive 1440–320px. Form submit được chặn, API dùng fixture; không kết nối database hoặc giao dịch thật.
- Cần kiểm tra thủ công sau khi restart Flask: đăng nhập khách hàng thật, mở orders.html, đối chiếu đơn hiện có và thử Sandbox/IPN đầu cuối nếu cần. Kiểm thử tự động không thay đổi dữ liệu PostgreSQL hiện tại.
