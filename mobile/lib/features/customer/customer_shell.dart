import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/network/api.dart';
import '../../core/theme/app_colors.dart';
import '../../models/catalog.dart';
import '../auth/auth_controller.dart';
import 'customer_home_controller.dart';

class HomeColors {
  HomeColors._();
  // Xanh đậm cho nhận diện và chữ nhấn.
  static const brand = AppColors.primaryDark;
  // Nền xanh nhạt cho khung khuyến mãi.
  static const mint = AppColors.primaryLight;
  // Bề mặt trắng và chữ trên nền xanh.
  static const surface = AppColors.surface;
  // Biểu tượng chuyên môn và ưu đãi.
  static const amber = AppColors.warning;
  // Nền ấm của khối tư vấn.
  static const cream = AppColors.warningBackground;
  // Nhãn giá giảm và chăm sóc.
  static const rose = AppColors.error;
  // Nền nhạt của biểu tượng chăm sóc.
  static const blush = AppColors.errorBackground;
}

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
    home = CustomerHomeController(
      CatalogApi(widget.controller.api.client),
      cartApi: CartApi(widget.controller.api),
    );
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
    if (value == 3) home.loadCart();
  }

  void pending(String title) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.support_agent, size: 48, color: HomeColors.brand),
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
  Future<void> showProduct(CatalogProduct product) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) => _ProductDetail(
          home: home,
          productId: product.id,
          onConsult: () => pending('Tư vấn thuốc'),
        ),
      );

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: home,
    builder: (context, _) => PopScope(
      canPop: tab == 0 && !home.browsing,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) selectTab(0);
      },
      child: Scaffold(
        key: const ValueKey('shell-customer'),
        body: SafeArea(
          bottom: false,
          child: NestedScrollView(
            // Logo cuộn khỏi màn hình; ô tìm kiếm là sliver ghim độc lập.
            headerSliverBuilder: (context, innerScrolled) => [
              const SliverToBoxAdapter(child: _BrandHeader()),
              SliverPersistentHeader(
                pinned: true,
                delegate: _SearchHeaderDelegate(
                  height:
                      76 +
                      math.max(
                            0,
                            MediaQuery.textScalerOf(context).scale(16) - 16,
                          ) *
                          1.5,
                  child: _SearchBar(
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
                ),
              ),
            ],
            body: tab == 4
                ? _AccountSection(controller: widget.controller)
                : tab == 3
                ? _CartSection(home: home)
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
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 760),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
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
                                    onConsult: () => pending('Tư vấn thuốc'),
                                  ),
                                ] else ...[
                                  _Greeting(
                                    name: widget.controller.user!.name,
                                    onOrders: () => pending('Đơn của tôi'),
                                  ),
                                  const SizedBox(height: 16),
                                  const _BrandBanner(),
                                  const SizedBox(height: 12),
                                  _ConsultBanner(
                                    onTap: () => pending('Tư vấn thuốc'),
                                  ),
                                  const SizedBox(height: 24),
                                  _PromotionsSection(
                                    home: home,
                                    onProduct: showProduct,
                                    onConsult: () => pending('Tư vấn thuốc'),
                                  ),
                                  const SizedBox(height: 28),
                                  _CategoriesSection(
                                    home: home,
                                    onCategory: (category) {
                                      search.clear();
                                      home.browse(selectedCategory: category);
                                    },
                                  ),
                                  const SizedBox(height: 32),
                                  const _BrandQuestions(),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ),
        bottomNavigationBar: MediaQuery.viewInsetsOf(context).bottom > 0
            ? null
            : _CustomerNavigation(
                selected: tab,
                onSelect: selectTab,
                cartCount: home.cartError == null
                    ? home.cart?.productCount
                    : null,
              ),
      ),
    ),
  );
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader();
  @override
  Widget build(BuildContext context) => ColoredBox(
    color: HomeColors.surface,
    child: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 792),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(
            children: [
              Image.asset(
                'assets/images/logo.png',
                width: 44,
                height: 44,
                excludeFromSemantics: true,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Lan Yến Pharmacy',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: HomeColors.brand,
                    fontWeight: FontWeight.w600,
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

class _SearchHeaderDelegate extends SliverPersistentHeaderDelegate {
  _SearchHeaderDelegate({required this.height, required this.child});
  final double height;
  final Widget child;
  @override
  double get minExtent => height;
  @override
  double get maxExtent => height;
  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) => child;
  @override
  bool shouldRebuild(_SearchHeaderDelegate oldDelegate) =>
      oldDelegate.height != height || oldDelegate.child != child;
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({
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
    color: HomeColors.surface,
    child: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 792),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(
            key: const ValueKey('home-search'),
            controller: search,
            textInputAction: TextInputAction.search,
            maxLength: 255,
            onSubmitted: onSearch,
            decoration: InputDecoration(
              labelText: 'Tìm thông tin thuốc',
              counterText: '',
              filled: true,
              fillColor: AppColors.background,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(100),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(100),
                borderSide: const BorderSide(color: AppColors.textSecondary),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(100),
                borderSide: const BorderSide(color: HomeColors.brand, width: 2),
              ),
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
        style: Theme.of(context).textTheme.titleMedium
            ?.copyWith(fontWeight: FontWeight.w600),
      );
      final orders = TextButton.icon(
        onPressed: onOrders,
        icon: const Icon(Icons.receipt_long_outlined, size: 20),
        label: const Text('Đơn của tôi'),
      );
      if (constraints.maxWidth < 320 ||
          MediaQuery.textScalerOf(context).scale(16) > 20) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [greeting, orders],
        );
      }
      return Row(
        children: [
          Expanded(child: greeting),
          const SizedBox(width: 8),
          orders,
        ],
      );
    },
  );
}

class _BrandBanner extends StatelessWidget {
  const _BrandBanner();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    decoration: BoxDecoration(
      color: HomeColors.mint,
      borderRadius: BorderRadius.circular(12),
    ),
    child: const Row(
      children: [
        Icon(Icons.spa_outlined, color: HomeColors.brand, size: 26),
        SizedBox(width: 12),
        Expanded(
          child: Text(
            'Chăm sóc sức khỏe,\nbắt đầu từ sự an tâm.',
            style: TextStyle(
              color: HomeColors.brand,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

class _ConsultBanner extends StatelessWidget {
  const _ConsultBanner({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: HomeColors.cream,
    borderRadius: BorderRadius.circular(12),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            const Icon(Icons.support_agent, color: HomeColors.amber, size: 30),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Tư vấn thuốc',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    'Dược sĩ đồng hành cùng bạn',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.forum_outlined, color: HomeColors.rose, size: 24),
          ],
        ),
      ),
    ),
  );
}

// Khung ưu đãi tách khỏi nền, chương trình và thời gian cuộn ngang cùng nhau.
class _PromotionsSection extends StatelessWidget {
  const _PromotionsSection({
    required this.home,
    required this.onProduct,
    required this.onConsult,
  });
  final CustomerHomeController home;
  final ValueChanged<CatalogProduct> onProduct;
  final VoidCallback onConsult;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: HomeColors.mint,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: HomeColors.brand.withValues(alpha: .24)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(4, 4, 4, 12),
          child: Row(
            children: [
              Icon(
                Icons.local_offer_rounded,
                color: HomeColors.brand,
                size: 24,
              ),
              SizedBox(width: 8),
              Expanded(child: _Heading('Ưu đãi từ Lan Yến')),
            ],
          ),
        ),
        if (home.promotionsError != null)
          _Status(message: home.promotionsError!, onRetry: home.loadPromotions)
        else if (home.promotionsLoading && home.promotions.isEmpty)
          const _Status(loading: true)
        else if (home.promotions.isEmpty)
          const _Status(
            message:
                'Chưa có chương trình khuyến mãi đang diễn ra hoặc sắp tới.',
          )
        else ...[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: home.promotions
                  .map(
                    (program) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _PromotionTab(
                        program: program,
                        selected: home.selectedPromotion?.id == program.id,
                        onTap: () => home.selectPromotion(program),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          if (home.selectedPromotion case final program?)
            _PromotionClock(home: home, program: program),
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
            _ProductRail(
              home: home,
              products: home.offers,
              onProduct: onProduct,
              onConsult: onConsult,
            ),
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
    ),
  );
}

class _PromotionClock extends StatelessWidget {
  const _PromotionClock({required this.home, required this.program});
  final CustomerHomeController home;
  final CatalogPromotion program;
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<DateTime>(
    valueListenable: home.clock,
    builder: (context, now, _) {
      final state = program.stateAt(now);
      final seconds = (program.remainingAt(now).inMilliseconds / 1000).ceil();
      final parts = [
        seconds ~/ 86400,
        seconds % 86400 ~/ 3600,
        seconds % 3600 ~/ 60,
        seconds % 60,
      ];
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 4),
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              state == 'UPCOMING'
                  ? 'Bắt đầu sau'
                  : state == 'ACTIVE'
                  ? 'Kết thúc sau'
                  : 'Đã kết thúc',
              style: const TextStyle(
                color: HomeColors.brand,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (state != 'ENDED')
              Semantics(
                label:
                    '${parts[0]} ngày ${parts[1]} giờ ${parts[2]} phút ${parts[3]} giây',
                excludeSemantics: true,
                child: Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: List.generate(
                    4,
                    (index) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: HomeColors.surface,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${parts[index].toString().padLeft(2, '0')}${index == 0
                            ? ' ngày'
                            : index == 1
                            ? 'h'
                            : index == 2
                            ? 'm'
                            : 's'}',
                        style: const TextStyle(
                          color: HomeColors.brand,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );
}

class _ProductRail extends StatelessWidget {
  const _ProductRail({
    required this.home,
    required this.products,
    required this.onProduct,
    required this.onConsult,
  });
  final CustomerHomeController home;
  final List<CatalogProduct> products;
  final ValueChanged<CatalogProduct> onProduct;
  final VoidCallback onConsult;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
      final width = scale > 1.4
          ? math.min(280.0, constraints.maxWidth)
          : math.min(224.0, math.max(164.0, (constraints.maxWidth - 12) / 2));
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: products
                .map(
                  (product) => Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: SizedBox(
                      width: width,
                      child: _ProductCard(
                        home: home,
                        product: product,
                        onTap: () => onProduct(product),
                        onConsult: onConsult,
                        compact: true,
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
      );
    },
  );
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({
    required this.home,
    required this.product,
    required this.onTap,
    required this.onConsult,
    this.compact = false,
  });
  final CustomerHomeController home;
  final CatalogProduct product;
  final VoidCallback onTap, onConsult;
  final bool compact;
  @override
  Widget build(BuildContext context) => Material(
    color: HomeColors.surface,
    borderRadius: BorderRadius.circular(12),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(8),
            child: Column(
              children: [
                _ProductImage(product: product),
                const SizedBox(height: 12),
                SizedBox(
                  height: compact
                      ? 63 * MediaQuery.textScalerOf(context).scale(16) / 16
                      : null,
                  child: Align(
                    alignment: Alignment.topLeft,
                    child: Text(
                      product.name,
                      maxLines: compact ? 3 : null,
                      overflow: compact ? TextOverflow.ellipsis : null,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (compact) const Spacer(),
          _PurchaseControls(
            home: home,
            product: product,
            onConsult: onConsult,
            compact: compact,
          ),
        ],
      ),
    ),
  );
}

class _PurchaseControls extends StatefulWidget {
  const _PurchaseControls({
    required this.home,
    required this.product,
    required this.onConsult,
    this.compact = false,
  });
  final CustomerHomeController home;
  final CatalogProduct product;
  final VoidCallback onConsult;
  final bool compact;
  @override
  State<_PurchaseControls> createState() => _PurchaseControlsState();
}

class _PurchaseControlsState extends State<_PurchaseControls> {
  int? selectedId;
  @override
  Widget build(BuildContext context) {
    final product = widget.product, home = widget.home;
    final price =
        product.prices.where((unit) => unit.id == selectedId).firstOrNull ??
        product.displayPrice;
    final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
    final available = price?.available == true;
    final exhausted = product.hasOffer && (price?.quota ?? 0) <= 0;
    final label = product.consultation
        ? 'Nhắn tin'
        : product.upcomingOffer
        ? 'Sắp diễn ra'
        : !available
        ? 'Hết hàng'
        : exhausted
        ? 'Hết ưu đãi'
        : 'Chọn mua';
    return ListenableBuilder(
      listenable: home,
      builder: (context, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _PriceLabel(product: product, selectedPrice: price),
          const SizedBox(height: 8),
          if (product.prices.length > 1 || product.consultation)
            ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: widget.compact ? 48 * scale : 0,
              ),
              child: product.prices.length > 1 && !product.consultation
                  ? DropdownButtonFormField<int>(
                      initialValue: price?.id,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Đơn vị',
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 8,
                        ),
                      ),
                      items: product.prices
                          .map(
                            (unit) => DropdownMenuItem(
                              value: unit.id,
                              child: Text(
                                unit.unit,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setState(() => selectedId = value),
                    )
                  : Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        product.consultation
                            ? 'Dược sĩ tư vấn trước khi mua'
                            : price?.unit ?? '',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
            ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: product.consultation
                ? widget.onConsult
                : !available ||
                      exhausted ||
                      product.upcomingOffer ||
                      home.adding
                ? null
                : () async {
                    await home.addToCart(product, price!);
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).hideCurrentSnackBar();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          home.purchaseMessage ?? 'Vui lòng kiểm tra giỏ hàng.',
                        ),
                      ),
                    );
                  },
            child: Text(
              home.adding && home.addingProductId == product.id
                  ? 'Đang thêm…'
                  : label,
            ),
          ),
        ],
      ),
    );
  }
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
  const _PriceLabel({required this.product, this.selectedPrice});
  final CatalogProduct product;
  final CatalogPrice? selectedPrice;
  @override
  Widget build(BuildContext context) {
    if (product.consultation) {
      return const Text(
        'Cần dược sĩ tư vấn',
        style: TextStyle(color: HomeColors.brand, fontWeight: FontWeight.w600),
      );
    }
    final price = selectedPrice ?? product.displayPrice;
    if (price == null) return const Text('Chưa công bố giá');
    final discounted =
        (product.activeOffer || price.activeOffer) && price.discounted;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${formatVnd(discounted ? price.sale! : price.original)} / ${price.unit}',
          style: const TextStyle(
            color: HomeColors.brand,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (discounted) ...[
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
      const Divider(),
      const SizedBox(height: 24),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.spa_outlined, size: 40, color: HomeColors.brand),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'LAN YẾN PHARMACY',
                  style: TextStyle(
                    fontSize: 12,
                    letterSpacing: 1.5,
                    color: HomeColors.brand,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Trao sự tận tâm,\ngửi trọn an tâm.',
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(color: HomeColors.brand),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Mỗi câu hỏi đều xứng đáng được lắng nghe. Mỗi lựa chọn sức khỏe đều cần sự thấu hiểu.',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
      const SizedBox(height: 24),
      const Row(
        children: [
          Icon(Icons.favorite_outline, color: HomeColors.rose, size: 20),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Quan tâm mỗi ngày. An tâm mỗi lựa chọn.',
              style: TextStyle(fontSize: 14, color: HomeColors.brand),
            ),
          ),
        ],
      ),
      const SizedBox(height: 16),
    ],
  );
}

class _ProductResults extends StatelessWidget {
  const _ProductResults({
    required this.home,
    required this.onProduct,
    required this.onConsult,
  });
  final CustomerHomeController home;
  final ValueChanged<CatalogProduct> onProduct;
  final VoidCallback onConsult;
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
              home: home,
              onConsult: onConsult,
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
  const _ProductDetail({
    required this.home,
    required this.productId,
    required this.onConsult,
  });
  final CustomerHomeController home;
  final int productId;
  final VoidCallback onConsult;
  @override
  State<_ProductDetail> createState() => _ProductDetailState();
}

class _ProductDetailState extends State<_ProductDetail> {
  late Future<CatalogProduct> request;
  @override
  void initState() {
    super.initState();
    request = widget.home.api.product(widget.productId);
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
                  () => request = widget.home.api.product(widget.productId),
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
                _PurchaseControls(
                  home: widget.home,
                  product: product,
                  onConsult: widget.onConsult,
                ),
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

class _CartSection extends StatelessWidget {
  const _CartSection({required this.home});
  final CustomerHomeController home;
  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: home.loadCart,
    child: ListView(
      key: const ValueKey('customer-cart'),
      padding: const EdgeInsets.all(24),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const _Heading('Giỏ hàng'),
        const SizedBox(height: 8),
        if (home.cartLoading)
          const _Status(loading: true)
        else if (home.cartError != null)
          _Status(message: home.cartError!, onRetry: home.loadCart)
        else if (home.cart?.items.isEmpty ?? true)
          const _Status(message: 'Giỏ hàng chưa có sản phẩm.')
        else ...[
          Text(
            '${home.cart!.productCount} sản phẩm',
            style: const TextStyle(color: HomeColors.brand),
          ),
          const SizedBox(height: 16),
          ...home.cart!.items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    item.name,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text('${item.quantity} ${item.unit}'),
                  if (!item.available)
                    const Text(
                      'Cần kiểm tra lại tồn kho',
                      style: TextStyle(color: HomeColors.rose),
                    ),
                  const SizedBox(height: 12),
                  const Divider(),
                ],
              ),
            ),
          ),
        ],
      ],
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

class _CustomerNavigation extends StatefulWidget {
  const _CustomerNavigation({
    required this.selected,
    required this.onSelect,
    required this.cartCount,
  });
  final int selected;
  final int? cartCount;
  final ValueChanged<int> onSelect;
  @override
  State<_CustomerNavigation> createState() => _CustomerNavigationState();
}

class _CustomerNavigationState extends State<_CustomerNavigation> {
  Timer? timer;
  int consultIcon = 0;
  static const consultIcons = [
    Icons.forum_outlined,
    Icons.support_agent,
    Icons.smart_toy_outlined,
  ];
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    timer?.cancel();
    // Giữ tên nút ổn định; tôn trọng thiết lập giảm chuyển động.
    if (!MediaQuery.disableAnimationsOf(context)) {
      timer = Timer.periodic(
        const Duration(seconds: 4),
        (_) => setState(
          () => consultIcon = (consultIcon + 1) % consultIcons.length,
        ),
      );
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.topCenter,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 24),
          child: Material(
            color: HomeColors.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(4, 10, 4, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: List.generate(
                  5,
                  (index) => Expanded(
                    child: _NavigationItem(
                      index: index,
                      selected: widget.selected,
                      cartCount: widget.cartCount,
                      onSelect: widget.onSelect,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        Semantics(
          label: 'Tư vấn',
          selected: widget.selected == 2,
          button: true,
          child: Material(
            color: HomeColors.brand,
            shape: const CircleBorder(
              side: BorderSide(color: HomeColors.surface, width: 5),
            ),
            child: InkWell(
              key: const ValueKey('customer-tab-2'),
              customBorder: const CircleBorder(),
              onTap: () => widget.onSelect(2),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: ExcludeSemantics(
                  child: AnimatedSwitcher(
                    duration: MediaQuery.disableAnimationsOf(context)
                        ? Duration.zero
                        : const Duration(milliseconds: 200),
                    child: Icon(
                      consultIcons[consultIcon],
                      key: ValueKey(consultIcon),
                      color: HomeColors.surface,
                      size: 28,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class _NavigationItem extends StatelessWidget {
  const _NavigationItem({
    required this.index,
    required this.selected,
    required this.cartCount,
    required this.onSelect,
  });
  final int index, selected;
  final int? cartCount;
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
  Widget build(BuildContext context) {
    final color = selected == index || index == 2
        ? HomeColors.brand
        : AppColors.textSecondary;
    final content = Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 44,
            child: index == 2
                ? null
                : Center(
                    child: Badge(
                      isLabelVisible: index == 3 && (cartCount ?? 0) > 0,
                      label: Text('${cartCount ?? 0}'),
                      child: Icon(icons[index], color: color),
                    ),
                  ),
          ),
          const SizedBox(height: 4),
          Text(
            labels[index],
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: color,
              fontWeight: selected == index ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ],
      ),
    );
    if (index == 2) return ExcludeSemantics(child: content);
    return Semantics(
      selected: selected == index,
      button: true,
      label: index == 3 && cartCount != null
          ? 'Giỏ hàng, $cartCount sản phẩm'
          : labels[index],
      excludeSemantics: true,
      child: InkWell(
        key: ValueKey('customer-tab-$index'),
        onTap: () => onSelect(index),
        borderRadius: BorderRadius.circular(8),
        child: content,
      ),
    );
  }
}

class _PromotionTab extends StatelessWidget {
  const _PromotionTab({
    required this.program,
    required this.selected,
    required this.onTap,
  });
  final CatalogPromotion program;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final color = selected ? HomeColors.surface : HomeColors.brand;
    return SizedBox(
      width: MediaQuery.textScalerOf(context).scale(16) > 24 ? 280 : 224,
      child: Semantics(
        selected: selected,
        child: Material(
          color: selected ? HomeColors.brand : HomeColors.surface,
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    program.name,
                    style: TextStyle(fontWeight: FontWeight.w600, color: color),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    program.dates,
                    style: TextStyle(fontSize: 12, color: color),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    program.active ? 'Đang diễn ra' : 'Sắp diễn ra',
                    style: TextStyle(fontSize: 12, color: color),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
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
