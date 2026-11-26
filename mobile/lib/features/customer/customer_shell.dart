import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/network/api.dart';
import '../../core/theme/app_colors.dart';
import '../../models/catalog.dart';
import '../auth/auth_controller.dart';
import 'customer_home_controller.dart';

class HomeColors {
  HomeColors._();
  // Nền thương hiệu và biểu tượng chính.
  static const brand = AppColors.primaryDark;
  // Nền nhạt khối tư vấn và danh mục.
  static const mint = AppColors.primaryLight;
  // Bề mặt nội dung và chữ trên nền thương hiệu.
  static const surface = AppColors.surface;
  // Biểu tượng ưu đãi và tư vấn chuyên môn.
  static const amber = AppColors.warning;
  // Nền nhấn ấm của biểu tượng.
  static const cream = AppColors.warningBackground;
  // Biểu tượng chăm sóc và nhãn ưu đãi.
  static const rose = AppColors.error;
  // Nền nhấn nhẹ của biểu tượng chăm sóc.
  static const blush = AppColors.errorBackground;
}

// Shell sở hữu trạng thái trang chủ; giữ nguyên shell nhân viên và quản lý.
class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key, required this.controller});
  final AuthController controller;
  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell>
    with WidgetsBindingObserver {
  late final CustomerHomeController home;
  final search = TextEditingController();
  int tab = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    home = CustomerHomeController(CatalogApi(widget.controller.api.client));
    home.load();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) home.load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    search.dispose();
    home.dispose();
    super.dispose();
  }

  void selectTab(int value) {
    FocusScope.of(context).unfocus();
    setState(() => tab = value);
    if (value == 0 && home.browsing) {
      home.closeSearch();
      search.clear();
    }
  }

  void pending(String title) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              title == 'Tư vấn thuốc'
                  ? Icons.forum_outlined
                  : Icons.receipt_long_outlined,
              size: 48,
              color: HomeColors.brand,
            ),
            const SizedBox(height: 16),
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              title == 'Tư vấn thuốc'
                  ? 'Kênh nhắn tin tư vấn đang được chuẩn bị. Bạn sẽ có thể trò chuyện tại đây khi tính năng sẵn sàng.'
                  : 'Chức năng này đang được hoàn thiện.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Đã hiểu'),
            ),
          ],
        ),
      ),
    ),
  );
  Future<void> showProduct(CatalogProduct product) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) =>
          _ProductDetail(api: home.api, productId: product.id),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: home,
    builder: (context, _) => PopScope(
      canPop: tab == 0 && !home.browsing,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          selectTab(0);
        }
      },
      child: Scaffold(
        key: const ValueKey('shell-customer'),
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              _HomeHeader(
                search: search,
                browsing: home.browsing,
                onBack: () {
                  home.closeSearch();
                  search.clear();
                },
                onSearch: (value) {
                  FocusScope.of(context).unfocus();
                  setState(() => tab = 0);
                  home.browse(query: value);
                },
              ),
              Expanded(
                child: tab == 4
                    ? _AccountSection(controller: widget.controller)
                    : tab != 0
                    ? _PendingDestination(
                        tab: tab,
                        onConsult: () => pending('Tư vấn thuốc'),
                      )
                    : RefreshIndicator(
                        onRefresh: home.browsing
                            ? () => home.browse(
                                query: home.search,
                                selectedCategory: home.category,
                              )
                            : home.load,
                        child: ListView(
                          key: ValueKey(
                            'home-${home.browsing}-${home.search}-${home.category?.id}',
                          ),
                          padding: const EdgeInsets.all(16),
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            Center(
                              child: ConstrainedBox(
                                constraints: const BoxConstraints(
                                  maxWidth: 760,
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    if (home.browsing) ...[
                                      Row(
                                        children: [
                                          IconButton(
                                            onPressed: () {
                                              home.closeSearch();
                                              search.clear();
                                            },
                                            tooltip: 'Về trang chủ',
                                            icon: const Icon(Icons.arrow_back),
                                          ),
                                          Expanded(
                                            child: _Heading(
                                              home.category?.name ??
                                                  (home.search.isEmpty
                                                      ? 'Tất cả sản phẩm'
                                                      : 'Kết quả tìm kiếm'),
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (home.search.isNotEmpty)
                                        Text('Từ khóa: ${home.search}'),
                                      _ProductResults(
                                        home: home,
                                        onProduct: showProduct,
                                      ),
                                    ] else ...[
                                      _Greeting(
                                        name: widget.controller.user!.name,
                                        onOrders: () => pending('Đơn của tôi'),
                                      ),
                                      const SizedBox(height: 20),
                                      _ConsultBanner(
                                        onTap: () => pending('Tư vấn thuốc'),
                                      ),
                                      const SizedBox(height: 28),
                                      _PromotionsSection(
                                        home: home,
                                        onProduct: showProduct,
                                      ),
                                      const SizedBox(height: 28),
                                      _CategoriesSection(
                                        home: home,
                                        onCategory: (category) {
                                          search.clear();
                                          home.browse(
                                            selectedCategory: category,
                                          );
                                        },
                                      ),
                                      const SizedBox(height: 28),
                                      const _BrandQuestions(),
                                      const SizedBox(height: 24),
                                      const Text(
                                        'Lan Yến Pharmacy\nChăm sóc sức khỏe, bắt đầu từ sự an tâm.',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                      const SizedBox(height: 16),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: _CustomerNavigation(
          selected: tab,
          onSelect: selectTab,
        ),
      ),
    ),
  );
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({
    required this.search,
    required this.browsing,
    required this.onBack,
    required this.onSearch,
  });
  final TextEditingController search;
  final bool browsing;
  final VoidCallback onBack;
  final ValueChanged<String> onSearch;
  @override
  Widget build(BuildContext context) => ColoredBox(
    color: HomeColors.brand,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: Column(
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.local_pharmacy_outlined,
                    color: HomeColors.surface,
                    size: 28,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Lan Yến Pharmacy',
                      style: Theme.of(context).textTheme.titleLarge
                          ?.copyWith(color: HomeColors.surface),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                key: const ValueKey('home-search'),
                controller: search,
                textInputAction: TextInputAction.search,
                maxLength: 255,
                onSubmitted: onSearch,
                decoration: InputDecoration(
                  labelText: 'Tìm thông tin thuốc',
                  counterText: '',
                  filled: true,
                  fillColor: HomeColors.surface,
                  prefixIcon: browsing
                      ? IconButton(
                          onPressed: onBack,
                          tooltip: 'Đóng tìm kiếm',
                          icon: const Icon(Icons.arrow_back),
                        )
                      : const Icon(Icons.search),
                  suffixIcon: IconButton(
                    tooltip: 'Tìm kiếm',
                    icon: const Icon(Icons.arrow_forward),
                    onPressed: () => onSearch(search.text),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.name, required this.onOrders});
  final String name;
  final VoidCallback onOrders;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final greeting = Text(
        'Xin chào, $name',
        style: Theme.of(context).textTheme.titleLarge,
      );
      final orders = OutlinedButton.icon(
        onPressed: onOrders,
        icon: const Icon(Icons.receipt_long_outlined),
        label: const Text('Đơn của tôi'),
      );
      if (constraints.maxWidth < 320 ||
          MediaQuery.textScalerOf(context).scale(16) > 20) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [greeting, const SizedBox(height: 8), orders],
        );
      }
      return Row(
        children: [
          Expanded(child: greeting),
          const SizedBox(width: 12),
          orders,
        ],
      );
    },
  );
}

class _ConsultBanner extends StatelessWidget {
  const _ConsultBanner({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: HomeColors.mint,
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Column(
              children: [
                Icon(Icons.forum_rounded, color: HomeColors.brand, size: 44),
                SizedBox(height: 8),
                Row(
                  children: [
                    Icon(
                      Icons.medication_rounded,
                      color: HomeColors.amber,
                      size: 24,
                    ),
                    SizedBox(width: 8),
                    Icon(
                      Icons.favorite_rounded,
                      color: HomeColors.rose,
                      size: 24,
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Tư vấn thuốc',
                    style: Theme.of(context).textTheme.titleLarge
                        ?.copyWith(color: HomeColors.brand),
                  ),
                  const SizedBox(height: 4),
                  const Text('Lắng nghe để thấu hiểu.\nTận tâm để đồng hành.'),
                  const SizedBox(height: 8),
                  const Text(
                    'Kênh nhắn tin sắp ra mắt',
                    style: TextStyle(color: HomeColors.brand),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _PromotionsSection extends StatelessWidget {
  const _PromotionsSection({required this.home, required this.onProduct});
  final CustomerHomeController home;
  final ValueChanged<CatalogProduct> onProduct;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Row(
        children: [
          Icon(Icons.local_offer_outlined, color: HomeColors.amber),
          SizedBox(width: 8),
          Expanded(child: _Heading('Ưu đãi từ Lan Yến')),
        ],
      ),
      const SizedBox(height: 12),
      if (home.promotionsError != null)
        _Status(message: home.promotionsError!, onRetry: home.loadPromotions)
      else if (home.promotionsLoading && home.promotions.isEmpty)
        const _Status(loading: true)
      else if (home.promotions.isEmpty)
        const _Status(
          message: 'Chưa có chương trình khuyến mãi đang diễn ra hoặc sắp tới.',
        )
      else ...[
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: home.promotions
              .map(
                (program) => ChoiceChip(
                  label: Text(program.name),
                  selected: home.selectedPromotion?.id == program.id,
                  onSelected: (_) => home.selectPromotion(program),
                ),
              )
              .toList(),
        ),
        if (home.selectedPromotion case final program?) ...[
          const SizedBox(height: 8),
          Text(
            '${program.active ? 'Đang diễn ra' : 'Sắp diễn ra'} · ${program.dates}',
            style: const TextStyle(color: HomeColors.brand),
          ),
        ],
        const SizedBox(height: 12),
        if (home.offersLoading)
          const _Status(loading: true)
        else if (home.offersError != null)
          _Status(
            message: home.offersError!,
            onRetry: () => home.selectPromotion(home.selectedPromotion!),
          )
        else if (home.offers.isEmpty)
          const _Status(
            message: 'Chưa có sản phẩm được công bố trong chương trình này.',
          )
        else
          _ProductRail(products: home.offers, onProduct: onProduct),
        if (!home.offersLoading &&
            home.offersError == null &&
            home.offerPages > 1)
          _Pagination(
            page: home.offerPage,
            pages: home.offerPages,
            onPage: (page) =>
                home.selectPromotion(home.selectedPromotion!, page: page),
          ),
      ],
    ],
  );
}

class _ProductRail extends StatelessWidget {
  const _ProductRail({required this.products, required this.onProduct});
  final List<CatalogProduct> products;
  final ValueChanged<CatalogProduct> onProduct;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
      final width = scale > 1.4
          ? math.min(290.0, constraints.maxWidth)
          : math.min(240.0, math.max(180.0, constraints.maxWidth * .57));
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: products
              .map(
                (product) => Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: SizedBox(
                    width: width,
                    child: _ProductCard(
                      product: product,
                      onTap: () => onProduct(product),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      );
    },
  );
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.onTap});
  final CatalogProduct product;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: HomeColors.surface,
    borderRadius: BorderRadius.circular(12),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _ProductImage(product: product),
            const SizedBox(height: 12),
            Text(
              product.name,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            _PriceLabel(product: product),
            if (product.prescription)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  'Thuốc kê đơn',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ),
            const SizedBox(height: 12),
            const Text(
              'Xem thông tin →',
              style: TextStyle(
                color: HomeColors.brand,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ProductImage extends StatelessWidget {
  const _ProductImage({required this.product});
  final CatalogProduct product;
  @override
  Widget build(BuildContext context) {
    final uri = Uri.tryParse(product.image);
    const placeholder = Center(
      child: Icon(
        Icons.medication_outlined,
        size: 48,
        color: AppColors.textSecondary,
      ),
    );
    return AspectRatio(
      aspectRatio: 1.15,
      child: uri != null && uri.scheme == 'https' && uri.host.isNotEmpty
          ? Image.network(
              product.image,
              fit: BoxFit.contain,
              semanticLabel: product.name,
              errorBuilder: (_, error, stack) => placeholder,
              loadingBuilder: (_, child, progress) =>
                  progress == null ? child : placeholder,
            )
          : placeholder,
    );
  }
}

class _PriceLabel extends StatelessWidget {
  const _PriceLabel({required this.product});
  final CatalogProduct product;
  @override
  Widget build(BuildContext context) {
    final price = product.displayPrice;
    if (price == null) return const Text('Chưa công bố giá');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${formatVnd(product.discounted ? price.sale! : price.original)} / ${price.unit}',
          style: const TextStyle(
            color: HomeColors.brand,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (product.discounted) ...[
          Text(
            formatVnd(price.original),
            semanticsLabel: 'Giá gốc ${formatVnd(price.original)}',
            style: const TextStyle(
              decoration: TextDecoration.lineThrough,
              color: AppColors.textSecondary,
            ),
          ),
          const Text('Đang ưu đãi', style: TextStyle(color: HomeColors.rose)),
        ],
        if (!price.available)
          const Text(
            'Tạm hết hàng',
            style: TextStyle(color: AppColors.textSecondary),
          ),
      ],
    );
  }
}

class _CategoriesSection extends StatelessWidget {
  const _CategoriesSection({required this.home, required this.onCategory});
  final CustomerHomeController home;
  final ValueChanged<CatalogCategory> onCategory;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const _Heading('Danh mục sản phẩm'),
      const SizedBox(height: 12),
      if (home.categoriesLoading)
        const _Status(loading: true)
      else if (home.categoriesError != null)
        _Status(message: home.categoriesError!, onRetry: home.loadCategories)
      else if (home.categories.isEmpty)
        const _Status(message: 'Chưa có danh mục được công bố.')
      else
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth > 560
                ? 3
                : MediaQuery.textScalerOf(context).scale(16) > 24
                ? 1
                : 2;
            final width = (constraints.maxWidth - (columns - 1) * 12) / columns;
            final items = home.expandedCategories
                ? home.categories
                : home.categories.take(6);
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: items
                  .map(
                    (category) => SizedBox(
                      width: width,
                      child: _CategoryTile(
                        category: category,
                        onTap: () => onCategory(category),
                      ),
                    ),
                  )
                  .toList(),
            );
          },
        ),
      if (home.categories.length > 6 &&
          !home.categoriesLoading &&
          home.categoriesError == null)
        TextButton(
          key: const ValueKey('expand-categories'),
          onPressed: home.toggleCategories,
          child: Text(
            home.expandedCategories
                ? 'Thu gọn danh mục'
                : 'Xem thêm ${home.categories.length - 6} danh mục',
          ),
        ),
    ],
  );
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category, required this.onTap});
  final CatalogCategory category;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: HomeColors.surface,
    borderRadius: BorderRadius.circular(12),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(
              _categoryIcon(category.name),
              size: 32,
              color: HomeColors.brand,
            ),
            const SizedBox(height: 12),
            Text(category.name, textAlign: TextAlign.center),
          ],
        ),
      ),
    ),
  );
}

// Chọn biểu tượng theo tên thật, không gán số lượng hoặc ý nghĩa điều trị.
IconData _categoryIcon(String name) {
  final text = name.toLowerCase();
  if (text.contains('tim') || text.contains('huyết áp')) {
    return Icons.monitor_heart_outlined;
  }
  if (text.contains('mắt')) return Icons.visibility_outlined;
  if (text.contains('chăm sóc da') || text.contains('cá nhân')) {
    return Icons.spa_outlined;
  }
  if (text.contains('thiết bị')) return Icons.medical_services_outlined;
  if (text.contains('vitamin')) return Icons.health_and_safety_outlined;
  if (text.contains('thần kinh')) return Icons.psychology_outlined;
  if (text.contains('xương')) return Icons.accessibility_new_outlined;
  return Icons.medication_outlined;
}

class _BrandQuestions extends StatelessWidget {
  const _BrandQuestions();
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const _Heading('Cùng tìm hiểu Lan Yến'),
      const SizedBox(height: 8),
      const Text(
        'Điều Lan Yến luôn trân trọng: sự an tâm của bạn.',
        style: TextStyle(color: AppColors.textSecondary),
      ),
      const SizedBox(height: 8),
      ...const <(String, String)>[
        (
          'Lan Yến Pharmacy mong muốn đồng hành như thế nào?',
          'Chăm sóc sức khỏe, bắt đầu từ sự an tâm. Lan Yến mong được cùng bạn chăm sóc sức khỏe của bản thân và những người thương yêu.',
        ),
        (
          'Điều gì được Lan Yến trân trọng?',
          'Mỗi câu hỏi đều xứng đáng được lắng nghe. Mỗi lựa chọn sức khỏe đều cần sự thấu hiểu.',
        ),
        (
          'Thông điệp của Lan Yến là gì?',
          'Trao sự tận tâm, gửi trọn an tâm. Lắng nghe để thấu hiểu. Tận tâm để đồng hành.',
        ),
      ].map(
        (item) => ExpansionTile(
          tilePadding: EdgeInsets.zero,
          title: Text(item.$1),
          childrenPadding: const EdgeInsets.only(bottom: 16),
          children: [
            Align(alignment: Alignment.centerLeft, child: Text(item.$2)),
          ],
        ),
      ),
    ],
  );
}

class _ProductResults extends StatelessWidget {
  const _ProductResults({required this.home, required this.onProduct});
  final CustomerHomeController home;
  final ValueChanged<CatalogProduct> onProduct;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      const SizedBox(height: 16),
      if (home.searchLoading)
        const _Status(loading: true)
      else if (home.searchError != null)
        _Status(
          message: home.searchError!,
          onRetry: () =>
              home.browse(query: home.search, selectedCategory: home.category),
        )
      else if (home.results.isEmpty)
        const _Status(
          message: 'Không tìm thấy sản phẩm phù hợp. Hãy thử từ khóa khác.',
        )
      else ...[
        ...home.results.map(
          (product) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _ProductCard(
              product: product,
              onTap: () => onProduct(product),
            ),
          ),
        ),
        _Pagination(
          page: home.resultPage,
          pages: home.resultPages,
          onPage: (page) => home.browse(
            query: home.search,
            selectedCategory: home.category,
            page: page,
          ),
        ),
      ],
    ],
  );
}

class _ProductDetail extends StatefulWidget {
  const _ProductDetail({required this.api, required this.productId});
  final CatalogApi api;
  final int productId;
  @override
  State<_ProductDetail> createState() => _ProductDetailState();
}

class _ProductDetailState extends State<_ProductDetail> {
  late Future<CatalogProduct> request;
  @override
  void initState() {
    super.initState();
    request = widget.api.product(widget.productId);
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SizedBox(
      height: MediaQuery.sizeOf(context).height * .8,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: FutureBuilder<CatalogProduct>(
          future: request,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return _Status(
                message: 'Chưa tải được thông tin sản phẩm.',
                onRetry: () => setState(
                  () => request = widget.api.product(widget.productId),
                ),
              );
            }
            final product = snapshot.data;
            if (product == null) return const _Status(loading: true);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Heading(product.name),
                const SizedBox(height: 16),
                _ProductImage(product: product),
                const SizedBox(height: 16),
                _PriceLabel(product: product),
                const SizedBox(height: 16),
                if (product.prescription) const Text('Thuốc kê đơn'),
                Text(
                  product.description.isEmpty
                      ? 'Chưa có mô tả sản phẩm.'
                      : product.description,
                ),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Đóng'),
                ),
              ],
            );
          },
        ),
      ),
    ),
  );
}

class _AccountSection extends StatelessWidget {
  const _AccountSection({required this.controller});
  final AuthController controller;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) => ListView(
      key: const ValueKey('customer-account'),
      padding: const EdgeInsets.all(24),
      children: [
        const _Heading('Tài khoản'),
        const SizedBox(height: 16),
        Text(
          controller.user?.name ?? '',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const Text('Khách hàng Lan Yến Pharmacy'),
        const SizedBox(height: 24),
        if (controller.error != null) _Status(message: controller.error!),
        OutlinedButton.icon(
          onPressed: controller.busy ? null : controller.logout,
          icon: const Icon(Icons.logout),
          label: const Text('Đăng xuất'),
        ),
      ],
    ),
  );
}

class _PendingDestination extends StatelessWidget {
  const _PendingDestination({required this.tab, required this.onConsult});
  final int tab;
  final VoidCallback onConsult;
  @override
  Widget build(BuildContext context) => ListView(
    key: ValueKey('customer-pending-$tab'),
    padding: const EdgeInsets.all(24),
    children: [
      _Heading(
        tab == 1
            ? 'Điểm thưởng'
            : tab == 2
            ? 'Tư vấn thuốc'
            : 'Giỏ hàng',
      ),
      const SizedBox(height: 16),
      const Text('Chức năng này đang được hoàn thiện.'),
      if (tab == 2) ...[
        const SizedBox(height: 16),
        _ConsultBanner(onTap: onConsult),
      ],
    ],
  );
}

class _CustomerNavigation extends StatelessWidget {
  const _CustomerNavigation({required this.selected, required this.onSelect});
  final int selected;
  final ValueChanged<int> onSelect;
  static const labels = [
    'Trang chủ',
    'Điểm thưởng',
    'Tư vấn',
    'Giỏ hàng',
    'Tài khoản',
  ];
  static const icons = [
    Icons.home_outlined,
    Icons.stars_outlined,
    Icons.forum_outlined,
    Icons.shopping_cart_outlined,
    Icons.person_outline,
  ];
  @override
  Widget build(BuildContext context) => Material(
    color: HomeColors.surface,
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: List.generate(
            5,
            (index) => Expanded(
              child: Semantics(
                selected: selected == index,
                button: true,
                child: InkWell(
                  key: ValueKey('customer-tab-$index'),
                  onTap: () => onSelect(index),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: index == 2
                                ? HomeColors.brand
                                : HomeColors.surface,
                          ),
                          child: Icon(
                            icons[index],
                            color: index == 2
                                ? HomeColors.surface
                                : selected == index
                                ? HomeColors.brand
                                : AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          labels[index],
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12,
                            color: selected == index
                                ? HomeColors.brand
                                : AppColors.textSecondary,
                            fontWeight: selected == index
                                ? FontWeight.w600
                                : FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Semantics(
    header: true,
    child: Text(text, style: Theme.of(context).textTheme.titleLarge),
  );
}

class _Status extends StatelessWidget {
  const _Status({
    this.message = 'Đang tải dữ liệu…',
    this.loading = false,
    this.onRetry,
  });
  final String message;
  final bool loading;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        children: [
          if (loading)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null)
            TextButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

class _Pagination extends StatelessWidget {
  const _Pagination({
    required this.page,
    required this.pages,
    required this.onPage,
  });
  final int page, pages;
  final ValueChanged<int> onPage;
  @override
  Widget build(BuildContext context) => Wrap(
    alignment: WrapAlignment.center,
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      IconButton(
        tooltip: 'Trang trước',
        onPressed: page > 1 ? () => onPage(page - 1) : null,
        icon: const Icon(Icons.chevron_left),
      ),
      Text('Trang $page / $pages'),
      IconButton(
        tooltip: 'Trang sau',
        onPressed: page < pages ? () => onPage(page + 1) : null,
        icon: const Icon(Icons.chevron_right),
      ),
    ],
  );
}
