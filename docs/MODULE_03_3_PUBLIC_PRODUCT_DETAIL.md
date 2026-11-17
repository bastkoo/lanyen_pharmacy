# Module 03.3 — Chi tiết thuốc công khai

Khách bấm ảnh hoặc tên thuốc từ danh sách hoặc khung sale để mở hộp thoại chi tiết.
Hai nút là phần tử button thật, dùng bàn phím được. Chọn đơn vị và nút Chọn mua vẫn
hoạt động riêng trên thẻ. Đã bỏ nhãn trạng thái khuyến mãi lặp phía dưới; chỉ còn
Đang diễn ra / Sắp diễn ra trên nút chọn chương trình.

## API và dữ liệu

`GET /api/products/<product_id>` trả `PRODUCT_FOUND` và `product`, không cần đăng nhập,
chỉ GET, no-store. Tham số duy nhất tùy chọn là `promotion_id`; từ chối tham số lạ,
lặp, ID không hợp lệ. Sản phẩm không tồn tại trả 404; chương trình hết hạn/không
tồn tại hoặc không chứa thuốc cũng trả 404. API quản lý không thay đổi.

Projection chi tiết mở rộng các trường danh sách bằng MaDuoc, MaVach, SoDangKy,
DangBaoChe, CachDung, ChongChiDinh, BaoQuan, PhanLoai và tên danh mục.
KeDon và PhanLoai hiển thị riêng: kê đơn và cần tư vấn dược sĩ là hai phân loại khác nhau.
Không xuất NguongTonKho, giá nhập, lô, số tồn chi tiết, hệ số quy đổi hoặc dữ liệu tài khoản.

- Mở từ sale gửi promotion_id để giữ đúng giá/quota của chương trình được chọn.
  Chương trình sắp tới vẫn là xem trước, nút mua bị khóa.
- Mở từ danh sách: máy chủ dùng phép tính giá hiện có để chọn ưu đãi đang diễn ra tốt
  nhất cho từng đơn vị, không cộng dồn. Mỗi đơn vị được báo giá độc lập khi xem lựa chọn;
  giỏ vẫn phân bổ quota theo số lượng thực sự thêm, không giữ quota khi mở chi tiết.
- Giá gốc, giá ưu đãi, quota và tên/mức chương trình cập nhật khi đổi đơn vị.
  Đơn vị không có ưu đãi hiển thị giá bình thường. Tồn khả dụng vẫn kiểm tra như trước.

## Giao diện và an toàn

Hộp thoại có ảnh trong vùng cố định, phần chọn giá/đơn vị, bảng thông số và các mục
mô tả, cách dùng, chống chỉ định, bảo quản. Nội dung lấy nguyên văn từ CSDL và render
bằng textContent; ảnh chỉ HTTPS. Không tự viết hướng dẫn y tế. Thiếu dữ liệu hiển thị
Chưa có thông tin. CSS và JavaScript dùng lại kiến trúc, token và giỏ hàng hiện có.

Native dialog quản lý focus; Escape/Đóng trả focus về ảnh/tên vừa chọn. Có trạng thái
tải, lỗi/thử lại, AbortController và version để không nhận phản hồi cũ sau khi đóng/mở
thuốc khác. Nhóm radio trong chi tiết có prefix riêng, không làm mất lựa chọn trên thẻ
phía sau. Trang chủ hiện không có khối tài khoản dưới nội dung; home.js xử lý phần
phản hồi phiên tùy chọn để đăng nhập trên header vẫn hoạt động.

## File và kiểm chứng

- Backend: public_catalog_schema/controller/routes, product_service, helper apply_offer
  dùng chung trong public_promotion_service. Không sửa model, schema PostgreSQL hoặc migration.
- Frontend: components/public-product-detail.js, public-catalog.js, cart.js, home.js và
  CSS chung home.css. Xóa nhãn dưới sale trong home.html và public-sale.js.
- 334 kiểm thử Python đạt; kiểm tra client JavaScript và browser fixture cho chi tiết
  từ danh sách/sale, giá theo đơn vị, ảnh/tên dùng bàn phím, XSS, đóng/trả focus,
  lỗi/thử lại, thêm giỏ và không tràn màn hình 320–1440px.
- PostgreSQL thật chỉ đọc: đối chiếu 3 thuốc đủ trường public, không có trường nội bộ;
  chi tiết theo 2 chương trình có đơn vị/giá/quota khớp danh sách sale. Không ghi dữ liệu thật.
