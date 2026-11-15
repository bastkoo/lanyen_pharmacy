# Module 02.7.3 — Frontend quản lý khuyến mãi

## Mở trang

Chạy frontend và Flask theo cấu hình hiện có, đăng nhập tài khoản quản lý VaiTro=2, không bị khóa. Mở `frontend/pages/manager/index.html#promotions` hoặc chọn **Chương trình khuyến mãi** trong điều hướng Manager. Không có chế độ giả lập đăng nhập hoặc dữ liệu mẫu trong frontend.

## Kết quả

Trang danh sách gồm tên, ngày bắt đầu/kết thúc, trạng thái và thao tác Xem/Sửa/Xóa; có Tạo chương trình, tìm tên, lọc trạng thái, làm mới và phân trang 20 dòng. Trạng thái tính theo ngày Việt Nam (Asia/Ho_Chi_Minh), gồm cả ngày đầu/cuối: Sắp diễn ra / Đang diễn ra / Đã kết thúc. Không gửi/trữ TrangThai trong database. Ngày hiển thị không bị dịch do timezone trình duyệt; kiểm tra đổi ngày khi trở lại tab/window và theo chu kỳ trong trang.

API chương trình chỉ hỗ trợ phân trang. Giao diện tải **đủ tất cả trang** (mỗi request 100 mục) trước khi tìm/lọc phía client. Nếu bất kỳ trang lỗi hoặc metadata thay đổi trong quá trình tải, hiển thị lỗi/thử lại, không trình bày kết quả thiếu như toàn bộ dữ liệu. Không thêm search/status vào query Backend.

Form chương trình chỉ có TenChuongTrinh, NgayBatDau, NgayKetThuc. Sửa lấy GET mới. Kiểm tra tên 1–255 Unicode code points sau trim, không NUL, ngày lịch hợp lệ và kết thúc không trước bắt đầu. Cho phép một ngày và chương trình trong quá khứ theo Backend. Không có NoiDung/MoTa/TrangThai.

Chi tiết tách thành thông tin chương trình phía trên và bảng thuốc phía dưới. Bảng hiển thị tên/ảnh thuốc nếu có, loại giảm, mức giảm, số sản phẩm còn được hưởng khuyến mãi, tình trạng hết/còn số lượng và Sửa/Xóa. Không tính giá sau giảm, không lấy tồn kho làm SoLuong. Khi SoLuong=0, hiển thị **Hết số lượng áp dụng**, giữ bản ghi để quản lý xem.

Chi tiết khuyến mãi được tải đủ các trang để chặn thuốc trùng trên toàn chương trình; bảng UI phân trang 20 dòng. Tên/ảnh thuốc lấy qua API thuốc hiện có cho các dòng đang hiển thị, có cache trong phiên xem chương trình. Không cần lấy toàn bộ hồ sơ thuốc. Lọc tên thuốc trong bảng chỉ áp dụng trang đang hiển thị, được ghi rõ ở label/caption/count/empty state.

Thêm thuốc có tìm kiếm API theo tên/mã dược/số đăng ký và phân trang 20 thuốc. Thuốc đã có trong chương trình được vô hiệu hóa, kể cả nếu nằm ngoài trang chi tiết đang hiển thị. Backend vẫn bảo vệ duplicate race. Khóa kép không sửa được.

Form giảm phần trăm nhận integer 1–100, nhãn %. Form giảm tiền nhận số không âm tối đa 9999999999.99, tối đa hai chữ số lẻ và nhãn VND. Không tự làm tròn; dùng dấu chấm thập phân khi nhập. Response GiaTriGiam vẫn là Decimal string hai chữ số lẻ; giao diện chuyển thành số JSON khi gửi theo contract. SoLuong khi thêm là số nguyên dương; khi sửa nhận 0–2147483647 để quản lý được bản ghi hết số lượng.

Xóa có GET mới và xác nhận. Chỉ tải lại danh sách sau mã thành công. Xóa chi tiết không xóa thuốc. Xóa chương trình có chi tiết bị PROMOTION_IN_USE, hiển thị lý do và giữ dữ liệu; không cascade.

## Điều chỉnh API đã được người dùng duyệt

Backend 02.7.2 ban đầu coi SoLuong là dump_only trên PUT; yêu cầu mới cho phép sửa. Đã hỏi và nhận xác nhận **Cho phép cập nhật API** trước khi sửa Backend.

- PromotionItemSchema nhận SoLuong tùy chọn, strict integer 0–2147483647.
- POST giữ SoLuong bắt buộc, API vẫn cho phép 0; frontend tạo mới yêu cầu dương theo yêu cầu giao diện.
- PUT vẫn yêu cầu LoaiGiamGia và GiaTriGiam. Nếu bỏ SoLuong thì giữ nguyên, bảo đảm client cũ hoạt động; nếu gửi thì cập nhật dưới SELECT FOR UPDATE hiện có.
- Repository chỉ gán ba trường writable; không đổi MaChuongTrinh/MaThuoc.
- Service hiện có đã truyền dictionary validated và khóa dòng nên không cần sửa service.
- Không sửa SQLAlchemy model, PostgreSQL schema, migration, tồn kho hoặc giá gốc.

Ví dụ PUT `/api/manager/promotions/7/items/3`:

```json
{
  "LoaiGiamGia": false,
  "GiaTriGiam": 1500.50,
  "SoLuong": 25
}
```

Response theo contract cũ mở rộng giá trị SoLuong:

```json
{
  "code": "PROMOTION_ITEM_UPDATED",
  "item": {
    "MaChuongTrinh": 7,
    "MaThuoc": 3,
    "LoaiGiamGia": false,
    "GiaTriGiam": "1500.50",
    "SoLuong": 25
  }
}
```

## API đã tích hợp

| Method | Endpoint |
| --- | --- |
| GET / POST | `/api/manager/promotions` |
| GET / PUT / DELETE | `/api/manager/promotions/<id>` |
| GET / POST | `/api/manager/promotions/<id>/items` |
| GET / PUT / DELETE | `/api/manager/promotions/<id>/items/<product_id>` |
| GET | `/api/manager/products` với search/page/per_page/sort_by/sort_order |
| GET | `/api/manager/products/<product_id>` |

Models khớp source hiện tại: chương trình có bốn trường; chi tiết có năm trường và khóa kép. Không có MaCTKM, PhanTramGiam hoặc DieuKien. Có đủ 10 endpoint khuyến mãi, không cần endpoint trùng hoặc payload giả.

## Bảo mật, trạng thái và thiết kế

Tái sử dụng Manager Layout, font Be Vietnam Pro cục bộ, Green 1.0 và token Manager. Không tạo shell mới hoặc thêm framework. Danh sách phục vụ theo dõi lịch; vùng chi tiết tập trung cấu hình thuốc, không dùng thẻ thống kê/biểu đồ trang trí. Bảng cuộn ngang trong region có nhãn trên mobile, form dialog một cột và cuộn được khi màn hình thấp.

Dùng API client session/CSRF hiện có; request ghi lấy token mới, không lưu localStorage. Guard Backend kiểm tra VaiTro=2 và trạng thái tài khoản. 401/403 quyền/tài khoản khóa đóng dialog, dọn dữ liệu và về gate. CSRF/validation/network lỗi giữ form; không tự retry request ghi. Chặn gửi trùng và Escape khi lưu/xóa.

Loading/empty/error/retry/success cho cả danh sách và chi tiết. AbortController và phiên bản request ngăn phản hồi cũ ghi đè khi đổi chương trình/rời trang/mất phiên. Tên API dùng textContent, ảnh chỉ HTTPS và ẩn khi lỗi. Form có label, aria-describedby, aria-invalid, thông báo lỗi; native modal hỗ trợ bàn phím, Escape và phục hồi focus.

## File tạo

- `frontend/js/api/promotions.js`
- `frontend/js/utils/promotion-validation.js`
- `frontend/js/pages/manager-promotions.js`
- `frontend/css/pages/manager-promotions.css`
- `backend/tests/test_promotions_frontend.mjs`
- `backend/tests/browser_promotions.mjs`
- `backend/tests/check_promotions_live.py`
- Tài liệu này và năm ảnh `MODULE_02_7_3_PROMOTIONS_{LIST_DESKTOP,LIST_MOBILE,DETAIL_DESKTOP,DETAIL_MOBILE,ITEM_FORM_MOBILE}.png`, có nhãn AUTH/API MOCK.

## File sửa

- `frontend/pages/manager/index.html` — mục điều hướng, danh sách, chi tiết, dialog và CSS.
- `frontend/js/utils/manager-view.js` — route promotions thứ bảy.
- `frontend/js/layouts/manager.js` — vòng đời/dọn dữ liệu trang mới.
- `backend/app/schemas/promotion_item_schema.py` — SoLuong tùy chọn trên PUT, được duyệt.
- `backend/app/repositories/chi_tiet_khuyen_mai_repository.py` — cập nhật SoLuong khi có trong payload.
- `backend/tests/test_promotion_items.py` — kiểm tra quantity tùy chọn/biên/type/keys và backward compatibility.
- `backend/tests/test_manager.mjs` — số route mới.
- `backend/tests/browser_manager.mjs` — tích hợp cờ --promotions; giữ ảnh QA module trước.
- `docs/MODULE_02_7_2_PROMOTION_ITEMS.md` — cập nhật contract SoLuong được duyệt.

## Kiểm chứng

```powershell
node --test backend/tests/test_frontend.mjs backend/tests/test_manager.mjs backend/tests/test_dashboard_frontend.mjs backend/tests/test_categories_frontend.mjs backend/tests/test_products_frontend.mjs backend/tests/test_units_frontend.mjs backend/tests/test_stock_frontend.mjs backend/tests/test_promotions_frontend.mjs
# 32/32 đạt

cd backend
.venv\Scripts\python.exe -m unittest discover -s tests -p test_promotion_items.py -v
# 31/31 đạt
.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
# 250/250 đạt; có ResourceWarning file tạm của bộ hồi quy, không có test thất bại
.venv\Scripts\python.exe tests/check_promotions_live.py
# PASS real Flask/PostgreSQL READ ONLY: list chương trình/thuốc và guard session/CSRF.
# SKIP populated promotion contracts: database hiện chưa có chương trình.

cd ..
node backend/tests/browser_manager.mjs --promotions --stock --units --products --categories --dashboard
```

Bộ Chrome khuyến mãi kiểm tra dữ liệu hơn 100 chương trình để chứng minh search/filter tải đủ trang, từ chối kết quả một phần khi trang API sau bị lỗi, trạng thái active/upcoming/ended, CRUD chương trình, ngày sai/giữ form, chặn gửi trùng/Escape, protected delete, danh sách/chi tiết, percentage/money create, hai số lẻ không làm tròn, sửa loại/mức giảm/SoLuong, SoLuong=0, disabled thuốc trùng ngoài trang UI, duplicate race, CSRF, 404, mạng/503/retry, hết phiên/403, phản hồi detail cũ, rỗng, keyboard/focus và không tràn trang/dialog tại 1440/1280/1024/768/375/320px. Toàn bộ API/AUTH ở browser fixture là MOCK, không ghi database.

Đã xem ảnh QA desktop/mobile của danh sách, chi tiết và form; kiểm tra syntax JS, assets/IDs và git diff --check. Hồi quy gồm Dashboard/danh mục/thuốc/đơn vị giá/lô/tồn kho/Manager và auth khách hàng.

## Giới hạn

Kiểm tra PostgreSQL thật chỉ đọc đã chạy được. Database hiện chưa có chương trình nên chưa kiểm chứng danh sách/chi tiết có bản ghi, CRUD ghi thật hoặc PUT SoLuong trên dữ liệu thật. Script dùng Flask test client với session ký cho tài khoản quản lý hiện có, vẫn chạy guard/DB thật; không phải kiểm thử OTP hoặc browser nối server thật. Không tạo dữ liệu thật chỉ để kiểm thử.

Lọc toàn bộ chương trình cần tải đủ danh sách vì API chưa có search/status; đây là giới hạn có chủ đích để kết quả không thiếu dữ liệu. Danh sách item cũng tải đủ để chống trùng; hồ sơ thuốc chỉ lấy trang đang hiển thị. Số lượng dữ liệu lớn có thể làm lần tải đầu lâu hơn; chưa thêm API/filter mới ngoài thay đổi SoLuong đã duyệt.

Không triển khai tính giá sau giảm, bán hàng/tự trừ SoLuong, giỏ hàng, đơn hàng, tài khoản, giá gốc hoặc tồn kho. Sau bàn giao dừng, chờ yêu cầu tiếp theo.
