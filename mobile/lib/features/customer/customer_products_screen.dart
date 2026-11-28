import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/catalog.dart';
import 'customer_components.dart';
import 'customer_home_controller.dart';
import 'customer_products_controller.dart';
import 'customer_product_widgets.dart';

class CustomerProductsColors {
  CustomerProductsColors._();
  // Nền toàn trang kết quả tìm kiếm/danh mục.
  static const background = AppColors.background;
  // Nền thanh tiêu đề có nút Trang chủ và Giỏ hàng.
  static const appBarBackground = AppColors.appBarBackground;
  // Tên danh mục hiện tại ở giữa thanh tiêu đề.
  static const appBarForeground = AppColors.appBarForeground;
  // Biểu tượng ngôi nhà bên trái thanh tiêu đề.
  static const homeIcon = AppColors.appBarForeground;
  // Biểu tượng giỏ hàng bên phải thanh tiêu đề.
  static const cartIcon = AppColors.appBarForeground;
  // Nền huy hiệu đếm sản phẩm trên biểu tượng giỏ hàng.
  static const cartBadgeBackground = AppColors.error;
  // Chữ số hoặc dấu cảnh báo trong huy hiệu giỏ hàng.
  static const cartBadgeText = AppColors.surface;
  // Chữ số lượng kết quả và từ khóa đang áp dụng.
  static const resultCount = AppColors.textSecondary;
  // Nền trắng của ô tìm kiếm và ô chọn bộ lọc.
  static const fieldBackground = AppColors.surface;
  // Chữ đang nhập/tên lựa chọn trong các ô tìm kiếm và lọc.
  static const fieldText = AppColors.textPrimary;
  // Viền ô nhập khi chưa nhận focus.
  static const fieldBorder = AppColors.textSecondary;
  // Viền xanh đậm khi đang nhập hoặc chọn bộ lọc.
  static const fieldFocus = AppColors.primaryDark;
  // Kính lúp, nút gửi và nút xóa từ khóa trong thanh tìm kiếm.
  static const searchIcon = AppColors.textSecondary;
  // Gợi ý Tên, danh mục hoặc mô tả trong ô tìm kiếm.
  static const searchHint = AppColors.textSecondary;
  // Nền khối chứa hai bộ lọc.
  static const filterPanel = AppColors.surface;
  // Chữ Bộ lọc sản phẩm phía trên hai ô lựa chọn.
  static const filterHeading = AppColors.textPrimary;
  // Biểu tượng bộ lọc cạnh chữ Bộ lọc sản phẩm.
  static const filterIcon = AppColors.primaryDark;
  // Chữ nút Xóa bộ lọc, giữ màu disabled do SDK điều khiển.
  static const filterReset = AppColors.primaryDark;
  // Viền nhẹ quanh khối bộ lọc, không thay viền của control bên trong.
  static const filterPanelBorder = AppColors.border;
}

// Trang riêng cho kết quả tìm kiếm/danh mục; tên trên Appbar luôn lấy từ bộ lọc hiện tại.
class CustomerProductsScreen extends StatefulWidget {
  const CustomerProductsScreen({
    super.key,
    required this.home,
    required this.onProduct,
    required this.onConsult,
    required this.onHome,
    required this.onCart,
    this.initialQuery = '',
    this.initialCategory,
  });
  final CustomerHomeController home;
  final String initialQuery;
  final CatalogCategory? initialCategory;
  final ValueChanged<CatalogProduct> onProduct;
  final VoidCallback onConsult, onHome, onCart;
  @override
  State<CustomerProductsScreen> createState() => _CustomerProductsScreenState();
}

// Đồng bộ Appbar/badge và nội dung theo hai controller, không giữ tên danh mục ban đầu làm tiêu đề.
class _CustomerProductsScreenState extends State<CustomerProductsScreen> {
  late final CustomerProductsController controller;
  late final TextEditingController search;
  late final Listenable updates;
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
    updates = Listenable.merge([controller, widget.home]);
    controller.initialize();
  }

  @override
  void dispose() {
    search.dispose();
    controller.dispose();
    super.dispose();
  }

  void submit(String value) {
    FocusScope.of(context).unfocus();
    controller.updateSearch(value);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: updates,
    builder: (context, _) => Scaffold(
      backgroundColor: CustomerProductsColors.background,
      appBar: AppBar(
        backgroundColor: CustomerProductsColors.appBarBackground,
        foregroundColor: CustomerProductsColors.appBarForeground,
        leading: IconButton(
          key: const ValueKey('products-home'),
          tooltip: 'Về trang chủ',
          onPressed: widget.onHome,
          icon: const Icon(
            Icons.home_outlined,
            color: CustomerProductsColors.homeIcon,
          ),
        ),
        title: Text(
          controller.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _CartAction(home: widget.home, onPressed: widget.onCart),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: Size.fromHeight(
            80 +
                (MediaQuery.textScalerOf(context).scale(16) - 16).clamp(
                      0,
                      100,
                    ) *
                    1.7,
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: _ProductsSearch(search: search, onSearch: submit),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => controller.load(requestedPage: controller.page),
        child: ListView(
          key: const ValueKey('products-list'),
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            _FilterPanel(controller: controller),
            const SizedBox(height: 16),
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
              if (controller.search.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Từ khóa: ${controller.search}',
                    style: const TextStyle(
                      fontSize: 14,
                      color: CustomerProductsColors.resultCount,
                    ),
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

// Ô tìm kiếm bo tròn, có xóa nhanh; gửi cùng từ khóa tới API Mobile tìm trên nhiều trường.
class _ProductsSearch extends StatelessWidget {
  const _ProductsSearch({required this.search, required this.onSearch});
  final TextEditingController search;
  final ValueChanged<String> onSearch;
  @override
  Widget build(BuildContext context) =>
      ValueListenableBuilder<TextEditingValue>(
        valueListenable: search,
        builder: (context, value, _) => TextField(
          key: const ValueKey('products-search'),
          controller: search,
          maxLength: 255,
          textInputAction: TextInputAction.search,
          onSubmitted: onSearch,
          style: const TextStyle(color: CustomerProductsColors.fieldText),
          decoration: _field('Tìm sản phẩm').copyWith(
            counterText: '',
            hintText: 'Tên, danh mục hoặc mô tả',
            hintStyle: const TextStyle(
              color: CustomerProductsColors.searchHint,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(100),
              borderSide: const BorderSide(
                color: CustomerProductsColors.fieldBorder,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(100),
              borderSide: const BorderSide(
                color: CustomerProductsColors.fieldFocus,
                width: 2,
              ),
            ),
            prefixIcon: const Icon(
              Icons.search,
              color: CustomerProductsColors.searchIcon,
            ),
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (value.text.isNotEmpty)
                  IconButton(
                    tooltip: 'Xóa từ khóa',
                    onPressed: () {
                      search.clear();
                      onSearch('');
                    },
                    icon: const Icon(
                      Icons.close,
                      color: CustomerProductsColors.searchIcon,
                    ),
                  ),
                IconButton(
                  tooltip: 'Tìm kiếm',
                  onPressed: () => onSearch(search.text),
                  icon: const Icon(
                    Icons.arrow_forward,
                    color: CustomerProductsColors.searchIcon,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

// Huy hiệu luôn đếm các sản phẩm riêng biệt; dấu ! biểu thị giỏ chưa đọc được thay vì giả số 0.
class _CartAction extends StatelessWidget {
  const _CartAction({required this.home, required this.onPressed});
  final CustomerHomeController home;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) {
    final failed = home.cartError != null;
    final count = failed ? null : home.cart?.productCount;
    return IconButton(
      key: const ValueKey('products-cart'),
      tooltip: 'Giỏ hàng',
      onPressed: onPressed,
      icon: Semantics(
        label: failed
            ? 'Giỏ hàng chưa tải được'
            : count == null
            ? 'Giỏ hàng đang tải'
            : 'Giỏ hàng, $count sản phẩm',
        child: Badge(
          isLabelVisible: failed || (count ?? 0) > 0,
          backgroundColor: CustomerProductsColors.cartBadgeBackground,
          textColor: CustomerProductsColors.cartBadgeText,
          label: Text(failed ? '!' : '$count'),
          child: const Icon(
            Icons.shopping_cart_outlined,
            color: CustomerProductsColors.cartIcon,
          ),
        ),
      ),
    );
  }
}

// Khối bộ lọc có nhãn rõ ràng và nút xóa đồng thời hai điều kiện.
class _FilterPanel extends StatelessWidget {
  const _FilterPanel({required this.controller});
  final CustomerProductsController controller;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: CustomerProductsColors.filterPanel,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: CustomerProductsColors.filterPanelBorder),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          children: [
            const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.tune,
                  size: 20,
                  color: CustomerProductsColors.filterIcon,
                ),
                SizedBox(width: 8),
                Text(
                  'Bộ lọc sản phẩm',
                  style: TextStyle(
                    color: CustomerProductsColors.filterHeading,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            TextButton(
              onPressed: controller.hasFilters ? controller.clearFilters : null,
              style: TextButton.styleFrom(
                foregroundColor: CustomerProductsColors.filterReset,
              ),
              child: const Text('Xóa bộ lọc'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _ProductFilters(controller: controller),
      ],
    ),
  );
}

// Kiểu ô danh mục/kê đơn; màu nằm trong bảng ở đầu chính trang này.
InputDecoration _field(String label) => InputDecoration(
  labelText: label,
  filled: true,
  fillColor: CustomerProductsColors.fieldBackground,
  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
  enabledBorder: OutlineInputBorder(
    borderRadius: BorderRadius.circular(8),
    borderSide: const BorderSide(color: CustomerProductsColors.fieldBorder),
  ),
  focusedBorder: OutlineInputBorder(
    borderRadius: BorderRadius.circular(8),
    borderSide: const BorderSide(
      color: CustomerProductsColors.fieldFocus,
      width: 2,
    ),
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

// Hai sản phẩm mỗi hàng; một cột khi phóng lớn chữ để giữ đủ giá và đơn vị.
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
      final columns = scale > 1.6 ? 1 : 2;
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
                                dense: false,
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
