# Đổi xu khi xác nhận mua hàng

Yêu cầu được duyệt ngày 18/11/2026: thêm `DonHang.DoiDiem` boolean; hiển thị xu vàng thay đơn vị điểm; đổi 1 xu = 100đ. Khi bật đổi xu, tự dùng số xu nguyên tối đa, giới hạn bởi số dư và tiền hàng sau khuyến mãi.

- Migration `58bd14a72f93` nối tiếp `31ac74d9e206`, chỉ thêm `DoiDiem`, `NOT NULL DEFAULT false`. Các đơn cũ nhận `false`.
- Cả POST `/api/orders` và POST `/api/orders/<id>/reorder/checkout` nhận tùy chọn `DoiDiem` boolean, mặc định `false`. Các request cũ vẫn dùng được.
- Backend lấy số dư từ `DiemThuong`, cộng `SoDiem` khi `LoaiGiaoDich=true`, trừ khi `false`. Số xu đổi = `min(max(số dư, 0), tiền sau khuyến mãi // 100)`.
- Không nhận số dư hay giá trị quy đổi do client cung cấp. `TongThanhToan` là tổng sau khuyến mãi và đổi xu, được đối chiếu lại trước khi tạo đơn.
- `TienGiamGia` bao gồm cả khuyến mãi và tiền đổi xu. `DoiDiem=true` khi thực tế đã dùng xu. Chi tiết giao dịch trừ xu nằm trong `DiemThuong`, lý do có mã đơn hàng.
- Khóa tài khoản trước khi kiểm tra số dư. Ghi giao dịch trừ xu cùng transaction với đơn, kho, hạn mức khuyến mãi và giỏ hàng; không commit riêng. Mua lại trực tiếp vẫn giữ nguyên giỏ.
- Xu bị trừ khi tạo đơn thành công cho cả COD và QR, cùng thời điểm trừ kho hiện tại; IPN thanh toán không trừ xu lần nữa. Khi hủy đơn hợp lệ, hoàn lại đúng số xu đã sử dụng theo dữ liệu phân bổ lưu cùng đơn. Không bổ sung quy tắc tích xu hoặc hoàn xu khi đổi trả.
- Nếu số dư hoặc giá thay đổi, trả `QUOTE_CHANGED`; nếu không còn xu có thể đổi, trả `POINTS_UNAVAILABLE`. Không ghi đơn hoặc trừ xu khi có lỗi.
- Giữ giới hạn lưu tiền hiện có của database. Đơn QR có tổng bằng 0 vẫn bị từ chối bằng `QR_AMOUNT_INVALID`; khách chọn thanh toán khi nhận hàng để hoàn tất đơn 0đ.

Giao diện xác nhận chỉ hiện dòng “Sử dụng xu: [số dư] [icon đồng xu vàng]” kèm nút gạt khi số dư lớn hơn 0. Nút gạt không bật sẵn; dòng giảm từ xu và tổng thanh toán cập nhật ngay. Menu avatar, sidebar và tiêu đề Xu tích lũy không có icon. Trang Xu tích lũy dùng đồng xu vàng có nhãn trợ năng, icon cạnh số dư to bằng chữ số. Trang chi tiết đơn ghi rõ khi tổng giảm bao gồm đổi xu.

## Hủy đơn và hoàn xu, kho, hạn mức khuyến mãi

Được người dùng phê duyệt: hủy đơn của chính chủ chỉ khi `TrangThaiDonHang` là 0 hoặc 1, chuyển sang 4. Hoàn đồng thời xu, tồn kho đúng lô và hạn mức khuyến mãi. Người dùng đồng ý thêm `DonHang.DuLieuHoanTra` JSONB nullable để lưu phân bổ chính xác; đơn cũ thiếu dữ liệu cần nhà thuốc đối soát, không tự suy đoán lô hoặc chương trình đã trừ.

- Migration `6a2f83c915e4` nối tiếp `58bd14a72f93`, chỉ thêm cột nullable, không tự điền phân bổ cho đơn cũ.
- Khi tạo đơn, lưu phiên bản dữ liệu, từng `MaLo/MaThuoc/SoLuong` theo FIFO thực tế, từng `MaChuongTrinh/MaThuoc/SoLuong` thực tế đã trừ và số xu thực tế đã đổi. Dữ liệu này không nhận từ client và không trả qua API.
- POST `/api/orders/<id>/cancel`, body `{}`, yêu cầu đăng nhập, đúng chủ đơn và CSRF. Client không quyết định trạng thái, số xu hoặc lượng kho/khuyến mãi được hoàn.
- Khóa tài khoản rồi khóa và đọc lại đơn trước khi kiểm tra trạng thái. Khóa hạn mức khuyến mãi trước lô thuốc theo thứ tự ổn định. Kiểm tra mọi tài nguyên trước khi cộng lại. Giao dịch hoàn xu `DiemThuong.LoaiGiaoDich=true`, lý do có mã đơn. Chỉ commit một lần cùng trạng thái hủy và toàn bộ phần hoàn.
- Gửi lặp sau khi đã hủy trả `ORDER_NOT_CANCELLABLE`, không hoàn lần hai. Thiếu dữ liệu phân bổ, lô hoặc chương trình đã bị xóa, hoặc phần hoàn vượt giới hạn lưu trữ trả `ORDER_REFUND_REVIEW_REQUIRED`; giữ nguyên đơn và không hoàn một phần.
- Có hộp xác nhận hủy ở danh sách đơn và chi tiết đơn. Hiện nút hủy chỉ cho trạng thái 0/1; khi báo cần đối soát, hướng dẫn liên hệ nhà thuốc.
- Giữ nguyên `DoiDiem` và số tiền trên đơn để bảo toàn thông tin giao dịch ban đầu. Không tự động hoàn tiền đã thanh toán qua QR; hộp xác nhận thông báo cần nhà thuốc xử lý khoản tiền đó riêng. IPN không kích hoạt lại đơn đã hủy.
