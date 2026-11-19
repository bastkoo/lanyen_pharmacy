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

Chỉ bộ lọc Đang xử lý hiển thị số lượng khi tổng đơn 0/1 từ 1 trở lên; tổng bằng 0 ẩn hẳn huy hiệu. Tổng độc lập với trang hoặc bộ lọc đang xem. Trạng thái 1 vẫn đang thực hiện, chưa hoàn tất xử lý.

## API chỉ đọc

`GET /api/orders?status=all&page=1&per_page=10`, role khách hàng 0, nhân viên 1 hoặc quản lý 2 mua hàng cho chính tài khoản mình. `page` từ 1 đến 2147483647; `per_page` từ 1 đến 50. Không nhận mã khách hàng do client chỉ định. Query lạ, bộ lọc sai hoặc tham số trùng trả 400.

Response `ORDERS_LISTED` gồm `items`, `total`, `processing_count`, `page`, `per_page`, `status`. Mỗi đơn gồm dữ liệu hiện có và `NgayDat`, `HinhThucNhanHang`, `item_count`, `items` (toàn bộ dòng sản phẩm), `preview`, `can_pay`. Mã BIGINT và tiền giữ dạng chuỗi. Giữ `preview` là dòng đầu để tương thích client cũ. Theo yêu cầu mới, giao diện danh sách chỉ hiển thị dòng đầu đại diện, kèm `+ N sản phẩm khác` khi có nhiều dòng. Giá và tổng tiền dùng dữ liệu đã lưu, không áp giá bán mới. Danh mục chỉ cung cấp tên/ảnh/đơn vị. Truy vấn luôn giới hạn chủ đơn, sắp ngày đặt/mã giảm dần; chi tiết của các đơn trên trang được tải chung, không truy vấn từng đơn.

## Thanh toán

`can_pay=true` chỉ khi QR, TrangThaiThanhToan=0, TrangThaiDonHang=0 và đã xác định môi trường Gateway. Nút Thanh toán gọi API POST payment hiện có rồi tự submit form SePay đã kiểm tra bằng utility chung. Backend vẫn kiểm tra quyền sở hữu/trạng thái/môi trường khi khởi tạo. Đơn cũ chưa xác định môi trường không tự chuyển sang Gateway. Không tạo đơn mới, trừ kho lần nữa hoặc cập nhật thanh toán từ URL.

Trang có trạng thái tải/rỗng/lỗi/thử lại, URL bộ lọc, phân trang, liên kết chi tiết và xóa dữ liệu riêng khi đăng xuất. Đơn Đã giao (3) và Đã hủy (4) có một nút Mua lại cho cả đơn. Nút mở dialog native với toàn bộ sản phẩm, cho bỏ chọn, Thêm vào giỏ hàng hoặc Mua ngay. Sản phẩm không đủ tồn hoặc không còn đơn vị bán bị vô hiệu hóa. Bỏ chọn hết thì hai nút thao tác bị vô hiệu hóa. Escape/Đóng trả focus về nút mở; đăng xuất xóa dữ liệu dialog.

## API và luồng mua lại

- `GET /api/orders/<id>/reorder`: chỉ chủ đơn ở trạng thái 3/4 được xem lựa chọn mua lại. Response `REORDER_OPTIONS`, `MaDonHang`, `items`: số lượng lấy từ chi tiết đơn, `GiaBan` lấy từ đơn vị bán hiện tại, `ConHang` dựa trên tồn kho còn hạn. Dialog ghi rõ giá trước khuyến mãi; ưu đãi tính lại ở giỏ/xác nhận.
- `POST /api/orders/<id>/reorder`: session, role 0/1/2 và CSRF. Payload duy nhất `{"MaChiTiet":["<id dòng đã chọn>"]}`. Không nhận số lượng, giá hoặc chủ đơn từ client. Kiểm tra sở hữu/trạng thái, dòng thuộc đơn, đơn vị bán, tổng tồn theo quy đổi gồm các dòng liên quan đang có trong giỏ. Cộng số lượng cũ vào giỏ trong một transaction bằng nghiệp vụ giỏ hiện có. Không trừ tồn hoặc hạn mức khuyến mãi, không tạo đơn mới. Lỗi rollback toàn bộ.
- Response `ORDER_REORDERED`, `unit_ids`: các đơn vị vừa thêm. Thêm vào giỏ giữ trang và báo thành công; Mua ngay chuyển `checkout.html?unit=...` với các đơn vị đã chọn. Dòng cùng đơn vị đã tồn tại trong giỏ được cộng số lượng, giữ nguyên dòng khác và không chọn chúng để checkout.
- Không tự thử lại mutation khi lỗi kết nối vì kết quả có thể chưa rõ; yêu cầu kiểm tra giỏ trước khi thêm lại. Chặn bấm lặp trong lúc xử lý. Không dùng giá/khuyến mãi cũ để thanh toán, không tự gửi Hoàn tất.

Không thêm chức năng hủy. Không thay đổi model/schema/migration, COD hoặc luồng IPN.

## Kiểm thử

- Backend: `.venv/Scripts/python.exe -m unittest discover -s tests -p test_orders.py` từ thư mục backend: bộ lọc, quyền sở hữu, role, query sai, điều kiện thanh toán, biên dịch SQL PostgreSQL, mua lại/số lượng/CSRF/tồn kho/rollback và hồi quy COD/Gateway/IPN.
- JavaScript: `node --test backend/tests/test_checkout_frontend.mjs`: 4 tests qua.
- Chrome: `node backend/tests/browser_manager.mjs --checkout`: qua checkout/detail/orders, sáu bộ lọc, ẩn huy hiệu 0, một sản phẩm đại diện, dialog mua lại/chọn bỏ/thêm giỏ/Mua ngay/không tạo đơn sớm/Escape/focus, form thanh toán, DOM an toàn, lỗi/rỗng/đăng xuất và responsive 1440–320px. Form submit được chặn, API dùng fixture; không kết nối database hoặc giao dịch thật.
- Cần kiểm tra thủ công sau khi restart Flask: đăng nhập khách hàng thật, mở orders.html, đối chiếu đơn hiện có và thử Sandbox/IPN đầu cuối nếu cần. Kiểm thử tự động không thay đổi dữ liệu PostgreSQL hiện tại.
