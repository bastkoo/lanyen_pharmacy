# MODULE 03.4 — Trang giỏ hàng khách hàng

## Phạm vi

Nút Giỏ hàng trên các trang khách hàng chuyển tới `frontend/pages/customer/cart.html`, thay cho hộp thoại giỏ hàng trước đây. Giữ header, footer và hệ màu Green 1.0 của Lan Yến.

Trang hỗ trợ chọn tất cả/từng dòng, xem chi tiết thuốc, chỉnh số lượng, đổi đơn vị và xóa sản phẩm. Khi đổi sang đơn vị đã có trong giỏ, số lượng của hai dòng được gộp. Số lượng nhập giữ nguyên khi đổi đơn vị, không tự quy đổi số hộp thành số vỉ. Lựa chọn checkbox chỉ áp dụng trong lần xem trang; dữ liệu giỏ tiếp tục lưu theo session khách hoặc tài khoản hiện có.

Hiển thị giá gốc, giá ưu đãi, số lượng được ưu đãi và tổng tiền của các dòng được chọn. Máy chủ tính lại ưu đãi trên phần được chọn để các dòng không chọn không chiếm hạn mức khuyến mãi. Tiếp tục dùng chương trình đang diễn ra có giá tốt nhất, không cộng dồn; hạn mức tính theo đơn vị nhỏ nhất, không giữ chỗ hay trừ hạn mức khi sửa giỏ.

Nút Mua hàng chuyển sang trang xác nhận nhận hàng/thanh toán của Module 03.8 khi có sản phẩm được chọn và báo giá thành công. Nút bị khóa khi đang tải, báo giá lỗi hoặc không có lựa chọn hợp lệ. Chưa tạo đơn hay thanh toán thật; tổng tiền giỏ vẫn là tạm tính chưa gồm phí giao hàng.

Sản phẩm được giảm giá có icon vé ưu đãi và mức giảm: phần trăm của chương trình hoặc số tiền thực giảm trên một đơn vị đang chọn. Icon này minh họa ưu đãi sản phẩm hiện có, không thêm chức năng nhập voucher. Thanh thông tin thanh toán ẩn dòng giảm giá và khối ưu đãi khi tổng giảm của các dòng được chọn bằng 0.

Icon vé ưu đãi dùng SVG trực tiếp để không phụ thuộc bộ nhớ đệm file icon. Header có huy hiệu đỏ đếm số `MaThuoc` khác nhau trong toàn bộ giỏ, không cộng số lượng hoặc đếm lại cùng thuốc ở các đơn vị khác nhau. Huy hiệu ẩn khi giỏ rỗng hoặc chưa tải được số lượng; cập nhật khi sửa giỏ và đổi trạng thái đăng nhập, không bật thông báo khi đọc số lượng.

## Tích hợp

- Giữ nguyên GET `/api/cart`, POST thêm và DELETE xóa sản phẩm.
- Bổ sung PUT `/api/cart/items/<unit_id>` nhận `MaDonGia`, `SoLuong` để sửa dòng thuộc giỏ hiện tại. Kiểm tra đơn vị cùng thuốc, số nguyên dương và tồn kho còn hạn. Lỗi cập nhật giữ nguyên dữ liệu.
- Bổ sung POST `/api/cart/quote` nhận danh sách `MaDonGia`, chỉ báo giá các dòng thuộc giỏ hiện tại, không ghi dữ liệu.
- Các thao tác mới kiểm tra CSRF; phản hồi giỏ không được cache. Không thay đổi cấu trúc PostgreSQL.
- GET giỏ bổ sung ảnh, tình trạng tồn và danh sách đơn vị để dựng giao diện. Các trường phản hồi hiện có được giữ lại.

## Xác minh

- Bộ kiểm thử Python: 338 bài đạt, gồm cập nhật/gộp đơn vị cho khách và tài khoản, quyền sở hữu, CSRF, kiểm tra dữ liệu, tồn kho và phân bổ ưu đãi khi chọn dòng.
- Bộ kiểm thử Node: 56 bài đạt.
- Kiểm thử trình duyệt với API giả lập: điều hướng trang riêng, chọn/bỏ chọn, tính tiền và ưu đãi, sửa/xóa, lưu giỏ khách khi tải lại, phân biệt giỏ tài khoản, lỗi ghi/báo giá và thử lại; nút mua không gửi đặt hàng.
- Kiểm tra bố cục tại 1440, 1280, 1024, 768, 375 và 320px, không tràn ngang; nội dung sản phẩm được dựng bằng DOM an toàn.
- Kiểm thử trình duyệt không ghi vào PostgreSQL thực tế. Luồng cập nhật giỏ tài khoản với cơ sở dữ liệu thực chưa được kiểm thử trong đợt này.
