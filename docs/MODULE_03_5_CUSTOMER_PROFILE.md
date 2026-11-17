# MODULE 03.5 — Tài khoản và thông tin cá nhân

## Giao diện

Header khách hàng hiển thị avatar khi đăng nhập, thay nút Đăng xuất trực tiếp. Khi chưa có ảnh hoặc ảnh tải lỗi, dùng ký tự đầu của phần tên (từ cuối trong họ tên). Menu có Thông tin cá nhân, Điểm tích lũy, Đơn hàng của tôi, Địa chỉ nhận hàng và Đăng xuất; hỗ trợ bàn phím, Escape, đóng khi click hoặc chuyển focus ra ngoài. Vai trò 2 có thêm Quản lý dẫn tới Tổng quan quản lý, vai trò 1 dẫn tới trang chủ nhân viên.

Thông tin cá nhân dẫn đến `frontend/pages/customer/profile.html`. Trang cho sửa họ tên, tải hoặc xóa ảnh đại diện. Số điện thoại chỉ đọc; không được gửi trong payload lưu. Ảnh tải lên chỉ được gắn vào tài khoản sau khi lưu thay đổi. Lưu thành công cập nhật avatar header; lỗi lưu giữ dữ liệu nhập. Trang xóa dữ liệu hiển thị khi đăng xuất và yêu cầu đăng nhập nếu chưa có phiên hợp lệ.

Các trang tài khoản dùng sidebar chung, chữ màu văn bản tối. Địa chỉ nhận hàng và Điểm tích lũy được bổ sung trong Module 03.6; Đơn hàng của tôi hiện có trang riêng với sidebar và thông tin chức năng đang hoàn thiện.

## Backend

- Dùng lại `NguoiDung.HoTen`, `SDT`, `AnhDaiDien`, không thay đổi schema/migration.
- GET `/api/auth/me` giữ nguyên hợp đồng.
- PUT `/api/auth/me` nhận đúng hai trường `HoTen`, `AnhDaiDien`; trả `PROFILE_UPDATED` và `user`. ID lấy từ phiên, không lấy từ client. Khóa dòng và kiểm tra lại trạng thái tài khoản trước ghi. Chặn mọi trường khác gồm số điện thoại, quyền và trạng thái.
- POST `/api/auth/me/avatar` nhận multipart với trường `image`, trả `UPLOAD_SUCCESS` và `data.url`, `data.public_id`. Dùng lại kiểm tra nội dung ảnh JPEG/PNG/WebP tối đa 5 MiB; yêu cầu phiên hoạt động và CSRF.
- Cloudinary dùng thư mục `lan-yen-pharmacy/avatars`, UUID, signed upload và không ghi đè. URL ảnh mới phải là ảnh thuộc thư mục avatar của cloud đã cấu hình và được kiểm chứng qua provider trước khi lưu. Avatar cũ không đổi hoặc xóa không gọi provider.
- Không xóa ảnh cũ trên Cloudinary khi đổi/xóa avatar, tránh xóa tài nguyên ngoài phạm vi. Cấu hình Cloudinary dùng lại các biến môi trường hiện có, không đưa secret xuống frontend.
- API hồ sơ và ảnh trả `Cache-Control: no-store`; lỗi upload không lộ nội dung exception của provider.

## Xác minh

Kiểm thử backend cô lập cơ sở dữ liệu và Cloudinary, bao gồm quyền sở hữu, whitelist trường, CSRF, tài khoản khóa, rollback/lỗi DB, URL sai thư mục và ảnh hỏng. Kiểm thử JavaScript xác minh payload, multipart, phiên/CSRF và không tự gửi lại thao tác ghi khi lỗi. Kiểm thử trình duyệt dùng fixture, không sửa PostgreSQL hay tải ảnh lên Cloudinary thực tế; bao gồm menu, chỉnh hồ sơ, tải lại trang, ảnh lỗi, lưu/xóa ảnh, lỗi mạng và hiển thị trên điện thoại.

Luồng ghi hồ sơ và upload với PostgreSQL/Cloudinary thực tế chưa được chạy trong đợt này.

Kết quả: 346 kiểm thử backend đạt; kiểm thử trình duyệt hồ sơ và các trang khách hàng liên quan đạt với fixture. Phần client kiểm tra lại chủ tài khoản trong phiên trước khi gửi lưu hoặc upload, nhằm chặn dữ liệu của phiên cũ bị ghi khi đổi tài khoản.
