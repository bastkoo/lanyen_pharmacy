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
}

// Trang chi tiết độc lập trên Navigator; nhận đúng ngữ cảnh chương trình khi mở từ ưu đãi.
class CustomerProductDetailScreen extends StatefulWidget {
  const CustomerProductDetailScreen({
    super.key,
    required this.home,
    required this.productId,
    required this.onConsult,
    this.promotionId,
  });
  final CustomerHomeController home;
  final int productId;
  final int? promotionId;
  final VoidCallback onConsult;
  @override
  State<CustomerProductDetailScreen> createState() =>
      _CustomerProductDetailScreenState();
}

// Chỉ giữ request đọc chi tiết; HTTP/endpoint vẫn tập trung trong api.dart.
class _CustomerProductDetailScreenState
    extends State<CustomerProductDetailScreen> {
  late Future<CatalogProduct> request;
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
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: CustomerDetailColors.background,
    appBar: AppBar(
      title: const Text(
        'Chi tiết sản phẩm',
        style: TextStyle(color: CustomerDetailColors.heading),
      ),
    ),
    body: FutureBuilder<CatalogProduct>(
      future: request,
      builder: (context, snapshot) {
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
        );
      },
    ),
  );
}

// Toàn bộ phần có thể cuộn: ảnh, tên, giá/đơn vị và dữ liệu đầy đủ từ Backend.
class _ProductDetailContent extends StatelessWidget {
  const _ProductDetailContent({
    required this.product,
    required this.home,
    required this.onConsult,
  });
  final CatalogProduct product;
  final CustomerHomeController home;
  final VoidCallback onConsult;
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
              ColoredBox(
                color: CustomerDetailColors.imageBackground,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 340),
                      child: CustomerProductImage(
                        product: product,
                        showOffer: product.prices.any((unit) => unit.quota > 0),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
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
              ),
              const SizedBox(height: 24),
              _ProductFacts(product: product),
              const SizedBox(height: 24),
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
        Text(
          label,
          style: const TextStyle(
            color: CustomerDetailColors.fieldLabel,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 4),
        SelectableText(
          value.isEmpty ? 'Chưa cập nhật' : value,
          style: const TextStyle(color: CustomerDetailColors.fieldValue),
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
    padding: const EdgeInsets.only(bottom: 24),
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
  );
}
