# Module 03.1 — Trang chủ và danh mục công khai

Phần sale mới và các quy tắc giá trong giỏ được mô tả tại [Module 03.2](MODULE_03_2_PUBLIC_SALE.md).

## Thông báo thao tác khách hàng

`components/customer-notice.js` hiển thị thông báo thành công, thất bại hoặc thông tin ở
góc dưới bên trái trên cả trang chủ và trang sản phẩm. Mỗi thông báo tự mất sau 5 giây;
thông báo mới thay nội dung cũ và bắt đầu lại đủ 5 giây. Không chuyển focus.
Nội dung dùng textContent, có nhãn/icon và role status/alert; màu dùng token hiện có.
Popover thủ công giúp thông báo nằm trên hộp thoại giỏ hàng, chuyển về trang khi đóng hộp thoại.
Kích thước giới hạn theo viewport và safe area, không đẩy lệch thẻ hoặc trang.

Áp dụng cho thêm/xóa giỏ, lỗi tải giỏ, OTP/đăng ký/đăng nhập/đăng xuất, kiểm tra phiên
do người dùng bấm, tìm/lọc/phân trang, tải lại danh mục và chọn/tải lại chương trình sale.
Các lần kiểm tra phiên tự động không hiển thị thông báo thành công. Lỗi tại form và
trạng thái cần nút Thử lại vẫn giữ để người dùng có thể xử lý sau khi thông báo ẩn.
Auth dialog nhận callback thông báo tùy chọn; trang quản lý giữ hành vi hiện có.

Đã kiểm tra bằng browser fixture: tự ẩn sau 5 giây, thông báo liên tiếp đặt lại thời gian,
thành công/lỗi, vị trí góc trái, không lấy focus, hiển thị trên/ngoài modal và vừa màn hình 320–1440px.

## Phạm vi và thiết kế

Trang chủ dành cho khách chưa đăng nhập, triển khai bằng HTML/CSS/ES Modules.
Giữ entry `frontend/index.html` chuyển đến `pages/customer/home.html` như kiến
trúc hiện tại. Font Be Vietnam Pro áp dụng riêng trang công khai theo yêu cầu
Module 03.1; không sửa token toàn cục hoặc font của trang khác.

Bố cục gồm header cố định có tìm kiếm, banner editorial, danh mục có icon, trang sản phẩm riêng,
giới thiệu, góc sức khỏe, tài khoản và footer. SVG banner được tự tạo cho dự án,
ghi rõ không phải sản phẩm đang bán. Không dựng giá, ưu đãi, chứng nhận, đánh giá,
số lượng giỏ hàng hoặc thông tin liên hệ giả.

Theo yêu cầu bổ sung ngày 17/11/2026, đã thêm API công khai chỉ đọc để dùng dữ liệu
thật. Theo yêu cầu tiếp theo đã bổ sung chọn đơn vị và giỏ hàng, dùng bảng `GioThuoc`
có sẵn. Không đổi schema PostgreSQL, migration hoặc hợp đồng API quản lý.
Không thêm framework hoặc dependency.

## API công khai

| Method | Endpoint | Tham số và kết quả |
| --- | --- | --- |
| GET | `/api/categories` | `search`, `page` (mặc định 1), `per_page` (mặc định 100, tối đa 100); `CATEGORIES_LISTED`, `items`, `page`, `per_page`, `total`, `pages` |
| GET | `/api/products` | `search`, `category_id`, `ke_don=true/false`, `sort_order=asc/desc` (mặc định asc), `page` (mặc định 1), `per_page` (mặc định 12, tối đa 100); `PRODUCTS_LISTED` và metadata như trên |

Cả hai endpoint không cần đăng nhập, chỉ có GET/HEAD/OPTIONS; POST/PUT/PATCH/DELETE
không được hỗ trợ. Tham số không hợp lệ, không được hỗ trợ hoặc lặp lại trả 400
`INVALID_REQUEST`. Danh mục không tồn tại trả 404 `CATEGORY_NOT_FOUND`; lỗi CSDL
trả 503 `DATABASE_UNAVAILABLE`, không lộ thông tin lỗi nội bộ.

Tái sử dụng truy vấn repository hiện có. Sản phẩm được sắp xếp theo tên và ID để
phân trang ổn định. Response sản phẩm chỉ gồm `MaThuoc`, `MaLoaiThuoc`, `TenThuoc`,
`HinhAnh`, `MoTa`, `QuyCachDongGoi`, `NhaSanXuat`, `NuocSanXuat`, `KeDon`, `DonViGia`.
`DonViGia` gồm `MaDonGia`, `DonViTinh`, `GiaBan`, `ConHang`, được truy vấn theo cả trang trong một lần,
sắp xếp giá giảm dần rồi ID. Không xuất ngưỡng tồn kho, giá nhập, số lượng quy đổi hoặc dữ liệu tài khoản.
Giá bán lấy trực tiếp từ `DonVi_GiaThuoc`, không suy ra từ đơn vị khác.

Frontend gọi `/api/categories` và `/api/products` với GET, `credentials: omit`,
không gửi cookie/CSRF và không gọi `/api/manager/`. Tìm kiếm sử dụng truy vấn thật;
không fake loading hoặc kết quả. Luồng `/api/auth/*` vẫn dùng OTP và CSRF hiện có;
bổ sung gộp giỏ khách trước khi tạo phiên đăng nhập mới.

## Danh mục và thuốc

- Tên và ID danh mục lấy từ PostgreSQL, tải đủ các trang. Không hardcode ID hoặc
  tạo lại 13 danh mục trong CSDL.
- Icon ánh xạ theo tên 13 danh mục đã được người dùng cung cấp: thiết bị y tế,
  chăm sóc da, mắt, tiêu hóa, vitamin, kháng sinh/nấm, tim mạch, thần kinh, cơ xương
  khớp, hô hấp, sinh lý/nội tiết, chăm sóc cá nhân và giảm đau/hạ sốt/kháng viêm.
  Chuẩn hóa dấu, hoa/thường và dấu gạch nối khi chọn icon. Danh mục mới dùng icon mặc định.
- Bấm danh mục mở `pages/customer/products.html?category_id=...` bằng liên kết thật.
  Tìm kiếm trên header cũng chuyển đến trang này với tham số `search`; không còn kết quả nhúng trên trang chủ.
- Thẻ thuốc hiển thị ảnh và tiêu đề `Tên thuốc (Quy cách đóng gói)`, đơn vị–giá
  và nút Chọn mua; bỏ dòng mô tả, nhà sản xuất và nhãn kê đơn trên thẻ theo yêu cầu rút gọn.
  Bộ lọc kê đơn vẫn lấy từ dữ liệu `KeDon`. Có placeholder ảnh khi thiếu hoặc tải lỗi.
- Trang sản phẩm có bộ lọc danh mục, kê đơn/không kê đơn, sắp xếp tên A–Z/Z–A và phân trang 12 mục.
  Các bộ lọc kết hợp với từ khóa, tự cập nhật và lưu trong URL. Tải lại hoặc Quay lại/Tiến tới khôi phục đúng lựa chọn.
  Bỏ bộ lọc giữ từ khóa tìm kiếm. Header tìm kiếm là tìm kiếm mới trên toàn bộ sản phẩm.
- Có loading/error/empty/retry và hủy request cũ khi đổi danh mục, ngăn phản hồi
  chậm ghi đè lựa chọn mới. Dữ liệu API được render bằng `textContent`; URL ảnh chỉ dùng HTTPS.

## Những phần giữ nguyên hoặc đang chờ

- Đăng nhập mở hộp thoại OTP hiện có, giữ markup và giao thức OTP.
  `home.js` dùng chung cho hai trang và chỉ cập nhật phần hồ sơ khi phần đó tồn tại; không đổi giao thức xác thực.
  Không buộc khách rời trang công khai để đăng nhập.
- Chưa có API bài viết công khai: giữ trạng thái chờ bài viết.
- Hướng dẫn mua hàng, bảo mật và điều khoản chưa có trang hoạt động:
  nút mở thông báo đang phát triển, không có link chết.
- Chưa có cấu hình liên hệ thực tế: footer nêu thông tin đang cập nhật.

## File triển khai

Frontend:

- `frontend/pages/customer/home.html`, `frontend/css/pages/home.css`: trang chủ, header tìm kiếm cố định và lưới danh mục responsive.
- `frontend/pages/customer/products.html`, `frontend/css/pages/public-products.css`: trang sản phẩm riêng với bộ lọc và kết quả.
- `frontend/js/pages/home.js`: phần hiển thị phiên dùng chung, giữ nguyên luồng OTP.
- `frontend/index.html`: mô tả trang, giữ chuyển hướng entry hiện có.
- `frontend/js/pages/public-home.js`: header tìm kiếm cố định, chuyển trang và các hộp thoại thông tin.
- `frontend/js/pages/public-products.js`: khởi tạo trang sản phẩm.
- `frontend/js/utils/public-catalog-filters.js`: đọc/ghi URL và kiểm tra bộ lọc.
- `frontend/js/components/public-catalog.js`: danh mục, tìm kiếm, sản phẩm và phân trang.
- `frontend/js/api/public-catalog.js`: client GET công khai.
- `frontend/js/utils/category-icons.js`: ánh xạ tên danh mục sang icon.
- `frontend/assets/icons/catalog-icons.svg`: bộ icon tự tạo cho danh mục.
- `frontend/assets/images/home-care-illustration.svg`: minh họa tự tạo cho banner.

Backend mới: `app/routes/public_catalog_routes.py`,
`app/controllers/public_catalog_controller.py`, `app/schemas/public_catalog_schema.py`.
Cập nhật `app/services/product_service.py` để serialize riêng dữ liệu công khai
và `app/__init__.py` để đăng ký blueprint. Truy vấn `thuoc_repository.py` hỗ trợ thêm lọc `KeDon`.
Thay đổi trang kết quả chỉ bổ sung tham số vào `/api/products` hiện có, không thêm endpoint mới. Không đổi model hoặc migration.

Kiểm thử: `backend/tests/browser_home.mjs`, `test_home_frontend.mjs`,
`test_public_catalog.py`, `test_public_catalog_frontend.mjs`; bổ sung cờ `--homepage`
vào `browser_manager.mjs`. Fixture chỉ có trong test server, ảnh QA lưu ở thư mục tạm.

## Chạy

Chạy Flask từ thư mục `backend` theo cấu hình hiện có (port 5000), khởi động lại
backend để đăng ký route mới. Từ thư mục `frontend`, chạy server của IDE hoặc:

```powershell
python -m http.server 5500
```

Mở `http://localhost:5500/` hoặc `http://localhost:5500/pages/customer/products.html`.
Origin frontend phải nằm trong danh sách CORS hiện có.
Nếu backend chưa chạy, trang giới thiệu vẫn mở; danh mục/sản phẩm có lỗi kết nối
và nút thử lại. Không dùng file:// để chạy ES Modules.

## Kiểm chứng

```powershell
node --test backend/tests/test_*.mjs
node backend/tests/browser_manager.mjs --homepage
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
```

- 53 kiểm thử JavaScript và 319 kiểm thử backend: đạt (bao gồm giỏ hàng và tồn khả dụng).
- Browser fixture: 13 danh mục/icon, chọn từng danh mục, danh sách thuốc/phân trang,
  tìm kiếm mở trang riêng, kết hợp danh mục/kê đơn/sắp xếp, URL/tải lại/Quay lại/Tiến tới,
  reset, empty/error/retry, request chậm, chống HTML injection, ảnh, header tìm kiếm cố định,
  keyboard/resize, session/OTP/logout trên hai trang và không gọi API quản lý: đạt.
- Đã kiểm tra metadata và API bằng PostgreSQL thật qua kết nối chỉ đọc: tại thời
  điểm kiểm tra có 13 danh mục, cả 13 có thuốc, tổng 87 thuốc. Mỗi response theo
  danh mục trả đúng `MaLoaiThuoc`, `KeDon` là boolean và không có trường nội bộ.
  Đã kiểm tra thêm lọc kê đơn true/false, kết hợp danh mục và sắp xếp tên với 87 thuốc.
  Không chạy DDL hoặc ghi dữ liệu thật.
- Bổ sung kiểm tra chỉ đọc PostgreSQL: 126 đơn vị của 87 thuốc có giá, liên kết và thứ tự đúng;
  thêm hai lần, xem và xóa giỏ khách bằng test client riêng thành công, không ghi CSDL.
- Responsive và focus được kiểm tra tại 1440, 1280, 1024, 1023, 768, 375, 320px.
  Ảnh QA được xem ở desktop/mobile; syntax JavaScript và `git diff --check` đạt.
- Luồng OTP giao diện dùng mock xác thực. Chưa kiểm chứng OTP/SMS thực tế hoặc
  đặt hàng; các chức năng đó không được triển khai trong yêu cầu này.

## Header và trang kết quả theo yêu cầu mới

Header công khai chỉ còn logo, tìm kiếm, tài khoản và giỏ hàng. Đã bỏ các mục Trang chủ/Danh mục thuốc/Góc sức khỏe/Liên hệ cùng menu mobile trên header; giữ điều hướng footer và toàn bộ nội dung giới thiệu bên dưới. Header dùng position: fixed; chiều cao được đo để nội dung và focus không bị che trên desktop/mobile.

## Chọn mua và giỏ hàng

- Một đơn vị: chỉ hiển thị giá / đơn vị; nhiều đơn vị: radio dạng nút, giá giảm dần
  từ trái sang phải, mặc định chọn đơn vị giá cao nhất. Đổi đơn vị cập nhật giá.
  Thuốc chưa có đơn vị–giá hợp lệ vẫn có nút Chọn mua nhưng bị vô hiệu hóa và có thông báo.
- Thẻ dùng flex dọc với vùng nội dung giãn đầy chiều cao; khối mua căn xuống đáy.
  Các nút đơn vị chia đều toàn bộ chiều ngang, đặt trước giá và nút mua.
  Thông báo thao tác đặt phía trên khối mua để giữ giá và nút mua thẳng hàng giữa các thẻ cùng hàng.
  Tên/quy cách được xuống dòng đầy đủ, không cắt mất nội dung; legend đơn vị vẫn có tên cho trình đọc màn hình.
- Thẻ thu gọn: desktop 4 cột, màn hình vừa 3 cột, tablet/mobile 2 cột;
  ảnh tỷ lệ 1.5, đệm 10–12px, tên 14px và giá 14–15px. Nút mua vẫn cao tối thiểu 44px.
- Vùng ảnh cố định theo tỷ lệ khung, ảnh và placeholder nằm tuyệt đối bên trong,
  không tham gia tính chiều cao nội dung. Ảnh dùng `object-fit: contain`, căn giữa
  và đệm thống nhất, giữ tỷ lệ đầy đủ; kích thước gốc hoặc trạng thái ảnh lỗi không làm giãn thẻ.
- Tồn khả dụng là tổng `SoLuongTon > 0` của các lô có `HanSuDung >= ngày hiện tại`
  theo múi giờ Việt Nam (giữ quy tắc hết hạn hiện có). Tổng này tính theo đơn vị nhỏ nhất.
  Không có lô hoặc chỉ còn lô hết hạn/hết tồn thì tổng bằng 0.
  Mỗi đơn vị có `ConHang = tổng tồn khả dụng >= SoLuongQuyDoi` với quy đổi dương.
  Truy vấn tồn được nhóm riêng theo thuốc trước khi ghép đơn vị để không nhân đôi số tồn.
  Không xuất số tồn chi tiết hoặc thông tin lô trong API công khai.
- Chọn đơn vị thiếu tồn đổi nút thành `Hết hàng` và vô hiệu hóa; vẫn cho chọn lại
  đơn vị khác. POST thêm giỏ kiểm tra lại đủ một đơn vị đang chọn, trả 409 `OUT_OF_STOCK`
  nếu không đủ. Không trừ/giữ tồn khi thêm giỏ; không tự xóa hoặc chặn gộp giỏ cũ
  khi hàng hết sau đó. Giỏ hàng không phải cam kết tồn kho cho thanh toán.
- Mỗi lần Chọn mua thêm 1 đơn vị đang chọn. Cùng thuốc và đơn vị cộng số lượng;
  các đơn vị khác nhau giữ dòng riêng. Không thay đổi tồn kho hoặc tạo đơn hàng.
- Nút Giỏ hàng ở header mở hộp thoại xem tên, quy cách, số lượng, đơn vị, giá,
  thành tiền và tạm tính; có xóa dòng, lỗi/thử lại và điều khiển bàn phím.
  Giá đọc lại từ CSDL khi xem giỏ, không tin giá hoặc mã chủ giỏ từ trình duyệt.
- Khách: session Flask ký bằng cookie HttpOnly hiện có, chỉ lưu bộ ba
  `[MaThuoc, MaDonGia, SoLuong]`, không lưu giá hoặc dữ liệu cá nhân.
  Giới hạn kỹ thuật 50 dòng để giữ cookie nhỏ; đăng nhập để lưu thêm vào CSDL.
- Đã đăng nhập: dùng bảng `GioThuoc` hiện có, luôn lọc theo ID từ session.
  Khóa hàng người dùng (`FOR UPDATE`) để tuần tự hóa thêm/gộp/xóa ngay cả khi giỏ rỗng;
  commit/rollback theo cả thao tác, không thêm unique constraint hoặc migration.
- Cả xác thực tài khoản có sẵn và đăng ký hồ sơ mới đều gộp giỏ khách trước
  `session.clear()`. Chỉ xóa giỏ khách khi commit thành công. Đơn vị bị xóa hoặc
  giá không hợp lệ làm gộp thất bại, giữ nguyên giỏ và hiển thị cách xử lý;
  không bỏ mất dòng một cách im lặng. Không gộp lại sau khi đã đăng nhập thành công.
- Client tuần tự hóa yêu cầu cookie giỏ/auth, dùng Web Locks giữa các tab cùng origin
  khi trình duyệt hỗ trợ. Không tự thử lại yêu cầu ghi sau lỗi kết nối.
- Các giá trị số lượng phải nằm trong miền INTEGER PostgreSQL. Giá trị tổng lớn
  được giữ chính xác bằng parser số nguyên và `BigInt` khi hiển thị.

| Method | Endpoint | Kết quả |
| --- | --- | --- |
| GET | `/api/cart` | Giỏ phiên/tài khoản hiện tại, `items`, `total`, `total_quantity`, `authenticated`, CSRF |
| POST | `/api/cart/items` | JSON chỉ có `MaThuoc`, `MaDonGia`; thêm 1 đơn vị, `CART_ITEM_ADDED` |
| DELETE | `/api/cart/items/<MaDonGia>` | Xóa dòng của chính giỏ hiện tại, `CART_ITEM_REMOVED` |

GET hỗ trợ khách, các thao tác ghi đều kiểm tra CSRF và Origin. Mọi response có
`Cache-Control: no-store`. Các route, controller, service, repository giỏ tách theo
kiến trúc hiện có: `cart_routes.py`, `cart_controller.py`, `cart_service.py`,
`gio_thuoc_repository.py`. Frontend dùng `api/cart.js`, `components/cart.js`,
`utils/session-requests.js` và CSS công khai hiện có.

Kiểm thử bổ sung: `test_cart.py`, `test_cart_frontend.mjs`, các ca OTP/đăng ký
trong `test_auth.py`, giá công khai trong `test_public_catalog.py`, thao tác giỏ
và gộp sau OTP trong `browser_home.mjs`. Đã kiểm tra cả hồi quy dashboard, quản lý
thuốc và đơn vị. Lưu/gộp giỏ tài khoản dùng repository giả lập trong kiểm thử;
chưa thử ghi giỏ tài khoản vào PostgreSQL thật để tránh tác động dữ liệu đang có.
