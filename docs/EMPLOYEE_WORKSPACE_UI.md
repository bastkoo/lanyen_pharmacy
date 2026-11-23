# Giao diện nhân viên

Trang: `frontend/pages/employee/index.html`. Giới hạn giao diện và API xử lý đơn cho `VaiTro = 1`, không dựa vào mã người dùng. Vai trò 0 và 2 nhận thông báo không thuộc khu vực nhân viên. Dùng API xác thực hiện có cho kiểm tra phiên, đăng nhập OTP và đăng xuất.

Sidebar dọc bên trái dùng điều hướng hash với liên kết, `aria-current` và tiêu đề riêng; trên mobile có nút mở/đóng menu dọc:

- `#messages`: danh sách hội thoại bên trái, nội dung trao đổi và ô soạn bên phải.
- `#orders` (mặc định): xử lý đơn hàng kết nối API; chi tiết trong `EMPLOYEE_ORDER_PROCESSING.md`.
- `#returns`: danh sách yêu cầu và vùng xem đơn, sản phẩm, nội dung liên quan. Chưa xác định hoặc triển khai chính sách đổi trả.

Nhắn tin và đổi trả vẫn ghi rõ chưa kết nối dữ liệu, controls disabled. Xử lý đơn dùng dữ liệu thật từ backend. Không đưa dữ liệu khách hàng giả, doanh thu hoặc bộ đếm giả vào ứng dụng. API nhân viên phân quyền phía backend, có CSRF cho thao tác ghi. Không thay đổi schema database.

Giữ Green 1.0, font Be Vietnam Pro cục bộ, dùng SVG cục bộ. Không thêm dashboard thống kê. Bố cục hai vùng chuyển thành một cột trên mobile; mỗi hàng đơn chuyển sang bố cục gọn có nhãn để tránh cắt số điện thoại. Có skip link, focus rõ, nhãn cho controls, thông báo phiên và trạng thái từ chối/lỗi/thử lại.

Kiểm tra giao diện: `node backend/tests/browser_manager.mjs --employee` với auth/API giả lập và ảnh chụp lưu trong thư mục tạm; không truy cập dữ liệu nghiệp vụ thật.
