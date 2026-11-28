import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/catalog.dart';
import 'customer_home_controller.dart';
import 'customer_components.dart';
import 'customer_product_widgets.dart';

class CustomerDetailColors {
  CustomerDetailColors._();
  // Nền toàn trang thông tin thuốc.
  static const background = AppColors.background;
  // Nền vùng chứa ảnh thuốc ở đầu trang.
  static const imageBackground = AppColors.surface;
  // Tên thuốc và tên các phần thông tin bên dưới.
  static const heading = AppColors.textPrimary;
  // Nhãn ở cột trái: Danh mục, Nhà sản xuất, Nước sản xuất...
  static const fieldLabel = AppColors.textSecondary;
  // Giá trị thông tin ở cột phải và nội dung cách dùng/chống chỉ định/bảo quản.
  static const fieldValue = AppColors.textPrimary;
  // Đường phân cách giữa từng dòng thông tin thuốc.
  static const divider = AppColors.border;
  // Biểu tượng mục lưu ý và điều kiện cần dược sĩ tư vấn.
  static const advice = AppColors.primaryDark;
  // Nền Appbar trang chi tiết.
  static const headerBackground = AppColors.appBarBackground;
  // Chữ Chi tiết sản phẩm trên Appbar.
  static const headerTitle = AppColors.appBarForeground;
  // Mũi tên quay lại trên Appbar.
  static const headerBackIcon = AppColors.appBarForeground;
  // Biểu tượng giỏ hàng góc trên bên phải.
  static const cartIcon = AppColors.appBarForeground;
  // Nền huy hiệu số sản phẩm của giỏ hàng.
  static const cartBadgeBackground = AppColors.error;
  // Số sản phẩm/dấu cảnh báo trong huy hiệu giỏ hàng.
  static const cartBadgeText = AppColors.surface;
  // Nền khối tên sản phẩm, giá và đơn vị tính.
  static const summaryBackground = AppColors.surface;
  // Nền khối các thuộc tính thuốc.
  static const factsBackground = AppColors.surface;
  // Nền các phần Mô tả, Cách dùng, Chống chỉ định và Bảo quản.
  static const informationBackground = AppColors.surface;
  // Nền thanh mua/nhắn tin cố định phía dưới.
  static const bottomBackground = AppColors.surface;
  // Đường phân cách phía trên thanh mua cố định.
  static const bottomBorder = AppColors.border;
  // Nền nút liên hệ hỗ trợ tròn bên phải nút mua.
  static const supportBackground = AppColors.primaryDark;
  // Biểu tượng tai nghe trên nút liên hệ hỗ trợ.
  static const supportIcon = AppColors.surface;
}

// Trang chi tiết độc lập trên Navigator; nhận đúng ngữ cảnh chương trình khi mở từ ưu đãi.
class CustomerProductDetailScreen extends StatefulWidget {
  const CustomerProductDetailScreen({
    super.key,
    required this.home,
    required this.productId,
    required this.onConsult,
    required this.onCart,
    this.promotionId,
  });
  final CustomerHomeController home;
  final int productId;
  final int? promotionId;
  final VoidCallback onConsult;
  final VoidCallback onCart;
  @override
  State<CustomerProductDetailScreen> createState() =>
      _CustomerProductDetailScreenState();
}

// Chỉ giữ request đọc chi tiết; HTTP/endpoint vẫn tập trung trong api.dart.
class _CustomerProductDetailScreenState
    extends State<CustomerProductDetailScreen> {
  late Future<CatalogProduct> request;
  int? selectedUnitId;
  @override
  void initState() {
    super.initState();
    request = _read();
  }

  Future<CatalogProduct> _read() => widget.home.api.product(
    widget.productId,
    promotionId: widget.promotionId,
  );
  @override
  Widget build(BuildContext context) => FutureBuilder<CatalogProduct>(
    future: request,
    builder: (context, snapshot) => Scaffold(
      backgroundColor: CustomerDetailColors.background,
      appBar: AppBar(
        backgroundColor: CustomerDetailColors.headerBackground,
        iconTheme: const IconThemeData(
          color: CustomerDetailColors.headerBackIcon,
        ),
        title: const Text(
          'Chi tiết sản phẩm',
          style: TextStyle(color: CustomerDetailColors.headerTitle),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _DetailCartAction(
              home: widget.home,
              onPressed: widget.onCart,
            ),
          ),
        ],
      ),
      bottomNavigationBar: snapshot.hasData
          ? _DetailBottomBar(
              home: widget.home,
              product: snapshot.data!,
              selectedUnitId: selectedUnitId,
              onConsult: widget.onConsult,
            )
          : null,
      body: Builder(
        builder: (context) {
          if (snapshot.hasError) {
            return CustomerStatus(
              message: 'Chưa tải được thông tin sản phẩm.',
              onRetry: () => setState(() => request = _read()),
            );
          }
          final product = snapshot.data;
          if (product == null) return const CustomerStatus(loading: true);
          return _ProductDetailContent(
            product: product,
            home: widget.home,
            onConsult: widget.onConsult,
            selectedUnitId: selectedUnitId,
            onUnitChanged: (id) => setState(() => selectedUnitId = id),
          );
        },
      ),
    ),
  );
}

// Giỏ hàng ở Appbar: đếm thuốc riêng biệt và cập nhật sau mỗi lần thêm.
class _DetailCartAction extends StatelessWidget {
  const _DetailCartAction({required this.home, required this.onPressed});
  final CustomerHomeController home;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: home,
    builder: (context, _) {
      final failed = home.cartError != null;
      final count = home.cart?.productCount;
      return IconButton(
        key: const ValueKey('detail-cart'),
        tooltip: 'Giỏ hàng',
        onPressed: onPressed,
        icon: Semantics(
          label: failed
              ? 'Giỏ hàng chưa tải được'
              : 'Giỏ hàng, ${count ?? 0} sản phẩm',
          child: Badge(
            isLabelVisible: failed || (count ?? 0) > 0,
            backgroundColor: CustomerDetailColors.cartBadgeBackground,
            textColor: CustomerDetailColors.cartBadgeText,
            label: Text(failed ? '!' : '$count'),
            child: const Icon(
              Icons.shopping_cart_outlined,
              color: CustomerDetailColors.cartIcon,
            ),
          ),
        ),
      );
    },
  );
}

// Thanh cố định luôn giữ nút mua/nhắn tin/hết hàng và nút hỗ trợ tròn trong vùng an toàn.
class _DetailBottomBar extends StatelessWidget {
  const _DetailBottomBar({
    required this.home,
    required this.product,
    required this.selectedUnitId,
    required this.onConsult,
  });
  final CustomerHomeController home;
  final CatalogProduct product;
  final int? selectedUnitId;
  final VoidCallback onConsult;
  @override
  Widget build(BuildContext context) => Container(
    key: const ValueKey('detail-bottom-bar'),
    decoration: const BoxDecoration(
      color: CustomerDetailColors.bottomBackground,
      border: Border(top: BorderSide(color: CustomerDetailColors.bottomBorder)),
    ),
    child: SafeArea(
      top: false,
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 792),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: CustomerPurchaseControls(
                    home: home,
                    product: product,
                    onConsult: onConsult,
                    showDetails: false,
                    selectedUnitId: selectedUnitId,
                  ),
                ),
                const SizedBox(width: 12),
                IconButton.filled(
                  key: const ValueKey('detail-support'),
                  tooltip: 'Liên hệ hỗ trợ',
                  onPressed: onConsult,
                  style: IconButton.styleFrom(
                    backgroundColor: CustomerDetailColors.supportBackground,
                    foregroundColor: CustomerDetailColors.supportIcon,
                    minimumSize: const Size(52, 52),
                    shape: const CircleBorder(),
                  ),
                  icon: const Icon(Icons.support_agent),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

// Toàn bộ phần có thể cuộn: ảnh, tên, giá/đơn vị và dữ liệu đầy đủ từ Backend.
class _ProductDetailContent extends StatelessWidget {
  const _ProductDetailContent({
    required this.product,
    required this.home,
    required this.onConsult,
    required this.selectedUnitId,
    required this.onUnitChanged,
  });
  final CatalogProduct product;
  final CustomerHomeController home;
  final VoidCallback onConsult;
  final int? selectedUnitId;
  final ValueChanged<int> onUnitChanged;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: home,
    builder: (context, _) => SingleChildScrollView(
      key: const ValueKey('product-detail-scroll'),
      padding: const EdgeInsets.all(16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: ColoredBox(
                  color: CustomerDetailColors.imageBackground,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 340),
                        child: CustomerProductImage(
                          product: product,
                          showOffer: product.prices.any(
                            (unit) => unit.quota > 0,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: CustomerDetailColors.summaryBackground,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    CustomerHeading(
                      product.displayName,
                      color: CustomerDetailColors.heading,
                    ),
                    const SizedBox(height: 16),
                    CustomerPurchaseControls(
                      home: home,
                      product: product,
                      onConsult: onConsult,
                      showEmptyQuota: false,
                      showAction: false,
                      selectedUnitId: selectedUnitId,
                      onUnitChanged: onUnitChanged,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: CustomerDetailColors.factsBackground,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const CustomerHeading(
                      'Thông tin sản phẩm',
                      color: CustomerDetailColors.heading,
                    ),
                    const SizedBox(height: 12),
                    _ProductFacts(product: product),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _InformationSection(title: 'Mô tả', content: product.description),
              _InformationSection(title: 'Cách dùng', content: product.usage),
              _InformationSection(
                title: 'Chống chỉ định',
                content: product.contraindications,
              ),
              _InformationSection(title: 'Bảo quản', content: product.storage),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    ),
  );
}

// Các thuộc tính của thuốc; dữ liệu thiếu được ghi rõ, không tự suy ra từ tên thuốc.
class _ProductFacts extends StatelessWidget {
  const _ProductFacts({required this.product});
  final CatalogProduct product;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      ...<(String, String)>[
        ('Danh mục', product.categoryName),
        ('Quy cách đóng gói', product.packaging),
        ('Loại kê đơn', product.prescription ? 'Thuốc kê đơn' : 'Không kê đơn'),
        ('Cần dược sĩ tư vấn?', product.consultation ? 'Có' : 'Không'),
        ('Dạng bào chế', product.dosageForm),
        ('Nhà sản xuất', product.manufacturer),
        ('Nước sản xuất', product.origin),
        ('Số đăng ký', product.registrationNumber),
        ('Mã dược', product.drugCode),
        ('Mã vạch', product.barcode),
      ].map((entry) => _FactRow(label: entry.$1, value: entry.$2)),
    ],
  );
}

// Một dòng nhãn/giá trị, chuyển xuống dòng trên màn nhỏ hoặc khi phóng lớn chữ.
class _FactRow extends StatelessWidget {
  const _FactRow({required this.label, required this.value});
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final labelWidget = Text(
              label,
              style: const TextStyle(
                color: CustomerDetailColors.fieldLabel,
                fontSize: 14,
              ),
            );
            final valueWidget = SelectableText(
              value.isEmpty ? 'Chưa cập nhật' : value,
              style: const TextStyle(color: CustomerDetailColors.fieldValue),
            );
            if (constraints.maxWidth < 300 ||
                MediaQuery.textScalerOf(context).scale(16) > 20) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [labelWidget, const SizedBox(height: 4), valueWidget],
              );
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(width: constraints.maxWidth * .38, child: labelWidget),
                const SizedBox(width: 12),
                Expanded(child: valueWidget),
              ],
            );
          },
        ),
        const SizedBox(height: 8),
        const Divider(color: CustomerDetailColors.divider, height: 1),
      ],
    ),
  );
}

// Nội dung dài luôn hiển thị và cuộn được, không giấu chống chỉ định sau nút mở rộng.
class _InformationSection extends StatelessWidget {
  const _InformationSection({required this.title, required this.content});
  final String title, content;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: CustomerDetailColors.informationBackground,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CustomerHeading(title, color: CustomerDetailColors.heading),
          const SizedBox(height: 8),
          SelectableText(
            content.isEmpty ? 'Chưa cập nhật' : content,
            style: const TextStyle(color: CustomerDetailColors.fieldValue),
          ),
        ],
      ),
    ),
  );
}
