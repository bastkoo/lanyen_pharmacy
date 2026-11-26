import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/catalog.dart';
import 'customer_components.dart';
import 'customer_home_controller.dart';
import 'customer_products_controller.dart';
import 'customer_product_widgets.dart';

class CustomerProductsColors {
  CustomerProductsColors._();
  // Nền trang danh sách sản phẩm.
  static const background = AppColors.background;
  // Nền thanh trên chứa tên trang và nút quay lại.
  static const appBarBackground = AppColors.background;
  // Chữ tên trang và mũi tên quay lại.
  static const appBarForeground = AppColors.textPrimary;
  // Chữ số sản phẩm phù hợp dưới bộ lọc.
  static const resultCount = AppColors.textSecondary;
  // Nền ô tìm kiếm và hai bộ lọc.
  static const fieldBackground = AppColors.surface;
  // Chữ trong ô tìm kiếm và bộ lọc.
  static const fieldText = AppColors.textPrimary;
  // Viền và nhãn của các ô lọc khi chưa focus.
  static const fieldBorder = AppColors.textSecondary;
  // Viền khi người dùng đang chọn bộ lọc.
  static const fieldFocus = AppColors.primaryDark;
  // Nút tìm kiếm trên bàn phím/ô nhập.
  static const searchIcon = AppColors.textSecondary;
}

// Danh sách riêng cho tìm kiếm hoặc danh mục; state giữ nguyên khi quay lại từ chi tiết.
class CustomerProductsScreen extends StatefulWidget {
  const CustomerProductsScreen({
    super.key,
    required this.home,
    required this.onProduct,
    required this.onConsult,
    this.initialQuery = '',
    this.initialCategory,
  });
  final CustomerHomeController home;
  final String initialQuery;
  final CatalogCategory? initialCategory;
  final ValueChanged<CatalogProduct> onProduct;
  final VoidCallback onConsult;
  @override
  State<CustomerProductsScreen> createState() => _CustomerProductsScreenState();
}

// Quản lý input và state danh sách, không chứa HTTP hoặc endpoint.
class _CustomerProductsScreenState extends State<CustomerProductsScreen> {
  late final CustomerProductsController controller;
  late final TextEditingController search;
  @override
  void initState() {
    super.initState();
    controller = CustomerProductsController(
      widget.home.api,
      search: widget.initialQuery,
      categoryId: widget.initialCategory?.id,
      categories: widget.home.categories,
    );
    search = TextEditingController(text: widget.initialQuery);
    controller.initialize();
  }

  @override
  void dispose() {
    search.dispose();
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: CustomerProductsColors.background,
    appBar: AppBar(
      backgroundColor: CustomerProductsColors.appBarBackground,
      foregroundColor: CustomerProductsColors.appBarForeground,
      title: Text(widget.initialCategory?.name ?? 'Danh sách sản phẩm'),
    ),
    body: ListenableBuilder(
      listenable: controller,
      builder: (context, _) => RefreshIndicator(
        onRefresh: () => controller.load(requestedPage: controller.page),
        child: ListView(
          padding: const EdgeInsets.all(12),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            TextField(
              key: const ValueKey('products-search'),
              controller: search,
              maxLength: 255,
              style: const TextStyle(color: CustomerProductsColors.fieldText),
              textInputAction: TextInputAction.search,
              onSubmitted: (value) {
                FocusScope.of(context).unfocus();
                controller.updateSearch(value);
              },
              decoration: _field('Tìm thông tin thuốc').copyWith(
                counterText: '',
                prefixIcon: const Icon(
                  Icons.search,
                  color: CustomerProductsColors.searchIcon,
                ),
                suffixIcon: IconButton(
                  tooltip: 'Tìm kiếm',
                  icon: const Icon(
                    Icons.arrow_forward,
                    color: CustomerProductsColors.searchIcon,
                  ),
                  onPressed: () {
                    FocusScope.of(context).unfocus();
                    controller.updateSearch(search.text);
                  },
                ),
              ),
            ),
            const SizedBox(height: 12),
            _ProductFilters(controller: controller),
            const SizedBox(height: 12),
            if (controller.loading)
              const CustomerStatus(loading: true)
            else if (controller.error != null)
              CustomerStatus(
                message: controller.error!,
                onRetry: () => controller.load(requestedPage: controller.page),
              )
            else if (controller.items.isEmpty)
              const CustomerStatus(
                message: 'Không tìm thấy sản phẩm phù hợp. Hãy thử bộ lọc hoặc từ khóa khác.',
              )
            else ...[
              Text(
                '${controller.total} sản phẩm phù hợp',
                style: const TextStyle(
                  color: CustomerProductsColors.resultCount,
                ),
              ),
              const SizedBox(height: 12),
              _ProductGrid(
                home: widget.home,
                items: controller.items,
                onProduct: widget.onProduct,
                onConsult: widget.onConsult,
              ),
              if (controller.pages > 1)
                CustomerPagination(
                  page: controller.page,
                  pages: controller.pages,
                  onPage: (page) => controller.load(requestedPage: page),
                ),
            ],
          ],
        ),
      ),
    ),
  );
}

// Kiểu ô nhập/lọc nhất quán; màu được khai báo ở đầu chính trang danh sách.
InputDecoration _field(String label) => InputDecoration(
  labelText: label,
  filled: true,
  fillColor: CustomerProductsColors.fieldBackground,
  enabledBorder: const OutlineInputBorder(
    borderSide: BorderSide(color: CustomerProductsColors.fieldBorder),
  ),
  focusedBorder: const OutlineInputBorder(
    borderSide: BorderSide(color: CustomerProductsColors.fieldFocus, width: 2),
  ),
);

// Hai bộ lọc lấy danh mục từ API và phân loại kê đơn theo đúng ke_don=true/false.
class _ProductFilters extends StatelessWidget {
  const _ProductFilters({required this.controller});
  final CustomerProductsController controller;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (controller.categoriesError != null)
        CustomerStatus(
          message: controller.categoriesError!,
          onRetry: controller.loadCategories,
        ),
      if (controller.categoriesLoading)
        const CustomerStatus(message: 'Đang tải danh mục…', loading: true),
      LayoutBuilder(
        builder: (context, constraints) {
          final categoryOptions = <DropdownMenuItem<int>>[
            const DropdownMenuItem(value: 0, child: Text('Tất cả danh mục')),
            ...controller.categories.map(
              (item) => DropdownMenuItem(
                value: item.id,
                child: Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ];
          if (controller.categoryId != null &&
              !controller.categories.any(
                (item) => item.id == controller.categoryId,
              )) {
            categoryOptions.add(
              DropdownMenuItem(
                value: controller.categoryId,
                child: const Text('Danh mục đang chọn'),
              ),
            );
          }
          final category = DropdownButtonFormField<int>(
            key: ValueKey('category-filter-${controller.categoryId}'),
            initialValue: controller.categoryId ?? 0,
            decoration: _field('Danh mục thuốc'),
            isExpanded: true,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: CustomerProductsColors.fieldText,
              fontSize: 14,
            ),
            items: categoryOptions,
            onChanged: (value) =>
                controller.filterCategory(value == 0 ? null : value),
          );
          final prescription = DropdownButtonFormField<String>(
            key: ValueKey('prescription-filter-${controller.prescription}'),
            initialValue: controller.prescription?.toString() ?? 'all',
            isExpanded: true,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: CustomerProductsColors.fieldText,
              fontSize: 14,
            ),
            decoration: _field('Phân loại kê đơn'),
            items: const [
              DropdownMenuItem(value: 'all', child: Text('Tất cả')),
              DropdownMenuItem(value: 'true', child: Text('Thuốc kê đơn')),
              DropdownMenuItem(value: 'false', child: Text('Không kê đơn')),
            ],
            onChanged: (value) => controller.filterPrescription(
              value == 'all' ? null : value == 'true',
            ),
          );
          if (constraints.maxWidth < 350 ||
              MediaQuery.textScalerOf(context).scale(16) > 20) {
            return Column(
              children: [category, const SizedBox(height: 12), prescription],
            );
          }
          return Row(
            children: [
              Expanded(child: category),
              const SizedBox(width: 12),
              Expanded(child: prescription),
            ],
          );
        },
      ),
    ],
  );
}

// Mặc định ba sản phẩm mỗi hàng; giảm cột khi chữ lớn để không cắt giá/đơn vị.
class _ProductGrid extends StatelessWidget {
  const _ProductGrid({
    required this.home,
    required this.items,
    required this.onProduct,
    required this.onConsult,
  });
  final CustomerHomeController home;
  final List<CatalogProduct> items;
  final ValueChanged<CatalogProduct> onProduct;
  final VoidCallback onConsult;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
      final columns = scale > 1.7
          ? 1
          : scale > 1.2
          ? 2
          : 3;
      return Column(
        children: [
          for (var start = 0; start < items.length; start += columns)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var slot = 0; slot < columns; slot++) ...[
                      if (slot > 0) const SizedBox(width: 8),
                      Expanded(
                        child: start + slot < items.length
                            ? CustomerProductCard(
                                home: home,
                                product: items[start + slot],
                                compact: true,
                                dense: true,
                                onTap: () => onProduct(items[start + slot]),
                                onConsult: onConsult,
                              )
                            : const SizedBox(),
                      ),
                    ],
                  ],
                ),
              ),
            ),
        ],
      );
    },
  );
}
