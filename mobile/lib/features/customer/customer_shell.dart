import 'package:flutter/material.dart';

import '../../core/constants/app_roles.dart';
import '../../core/network/api.dart';
import '../../core/theme/app_colors.dart';
import '../../models/catalog.dart';
import '../auth/auth_controller.dart';
import '../auth/login_screen.dart';
import '../auth/login_required_dialog.dart';
import 'customer_home_controller.dart';
import 'customer_home_screen.dart';
import 'customer_navigation.dart';
import 'customer_account_screen.dart';
import 'customer_rewards_screen.dart';
import 'customer_messages_screen.dart';
import 'customer_cart_screen.dart';
import 'customer_products_screen.dart';
import 'customer_product_detail_screen.dart';

class CustomerShellColors {
  CustomerShellColors._();
  // Nền sau các trang và phía trên nút tư vấn nổi của khung khách hàng.
  static const background = AppColors.background;
  // Chữ trong thông báo Đơn của tôi chưa hoàn thiện.
  static const orderMessage = AppColors.textPrimary;
  // Nền trang mở biểu mẫu đăng nhập từ hộp thoại thành viên.
  static const loginBackground = AppColors.background;
  // Nền thanh tiêu đề Đăng nhập.
  static const loginHeaderBackground = AppColors.background;
  // Chữ Đăng nhập trên thanh tiêu đề.
  static const loginHeaderTitle = AppColors.textPrimary;
  // Mũi tên quay lại trang đang xem trước khi đăng nhập.
  static const loginBackIcon = AppColors.textPrimary;
  // Chữ thông báo bước đặt hàng sẽ bổ sung sau.
  static const checkoutMessage = AppColors.textPrimary;
}

// Khung khách hàng chỉ sở hữu state dùng chung và chuyển trang; không chứa UI của từng trang.
class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key, required this.controller});
  final AuthController controller;
  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

// Quản lý năm mục dưới cùng và state giỏ/ưu đãi dùng chung giữa danh sách và chi tiết.
class _CustomerShellState extends State<CustomerShell>
    with WidgetsBindingObserver {
  late final CustomerHomeController home;
  int tab = 0;
  bool get authenticated =>
      widget.controller.stage == AuthStage.authenticated &&
      widget.controller.user?.role == AppRole.customer;
  int? get customerId => authenticated ? widget.controller.user!.id : null;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    home = CustomerHomeController(
      CatalogApi(widget.controller.api.client),
      cartApi: CartApi(widget.controller.api),
      guestCart: widget.controller.guestCart,
      customerId: customerId,
    );
    widget.controller.addListener(authChanged);
    home.load();
  }

  void authChanged() {
    if (home.customerId != customerId) {
      tab = 0;
      home.changeCustomer(customerId);
    }
  }

  Future<void> requestLogin() async {
    if (!await showLoginRequired(context) || !mounted) return;
    await openLogin();
  }

  Future<void> openLogin() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => _LoginRoute(controller: widget.controller),
      ),
    );
  }

  void checkout() {
    if (!authenticated) {
      openLogin();
      return;
    }
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(
          'Mua hàng',
          style: TextStyle(color: CustomerShellColors.checkoutMessage),
        ),
        content: const Text(
          'Bước xác nhận đặt hàng sẽ được bổ sung sau.',
          style: TextStyle(color: CustomerShellColors.checkoutMessage),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đã hiểu'),
          ),
        ],
      ),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) home.load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.controller.removeListener(authChanged);
    home.dispose();
    super.dispose();
  }

  void selectTab(int value) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    if (!authenticated && (value == 1 || value == 2 || value == 4)) {
      requestLogin();
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => tab = value);
    if (value == 3) home.loadCart();
  }

  Future<void> openPage(Widget page) {
    final user = widget.controller.user;
    if (user != null && user.role != AppRole.customer) {
      return Future.value();
    }
    return Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => _CustomerRoute(
          controller: widget.controller,
          userId: authenticated ? user!.id : null,
          child: page,
        ),
      ),
    );
  }

  Future<void> openMessages() =>
      authenticated ? openPage(const CustomerMessagesScreen()) : requestLogin();
  void showHome() {
    selectTab(0);
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  void showCart() {
    selectTab(3);
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  Future<void> openDetail(CatalogProduct product, {int? promotionId}) =>
      openPage(
        CustomerProductDetailScreen(
          home: home,
          productId: product.id,
          promotionId: promotionId ?? product.promotionId,
          onConsult: openMessages,
          onCart: showCart,
        ),
      );
  Future<void> openProducts(String query, CatalogCategory? category) =>
      openPage(
        CustomerProductsScreen(
          home: home,
          initialQuery: query,
          initialCategory: category,
          onHome: showHome,
          onCart: showCart,
          onProduct: (product) => openDetail(product),
          onConsult: openMessages,
        ),
      );
  void showOrders() {
    if (!authenticated) {
      requestLogin();
      return;
    }
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(
          'Đơn của tôi',
          style: TextStyle(color: CustomerShellColors.orderMessage),
        ),
        content: const Text(
          'Chức năng này đang được hoàn thiện.',
          style: TextStyle(color: CustomerShellColors.orderMessage),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đã hiểu'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: home,
    builder: (context, _) => PopScope(
      canPop: tab == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) selectTab(0);
      },
      child: Scaffold(
        key: const ValueKey('shell-customer'),
        backgroundColor: CustomerShellColors.background,
        body: SafeArea(
          bottom: false,
          child: switch (tab) {
            1 => const CustomerRewardsScreen(),
            2 => const CustomerMessagesScreen(),
            3 => CustomerCartScreen(
              home: home,
              onContinue: () => selectTab(0),
              onCheckout: checkout,
            ),
            4 => CustomerAccountScreen(controller: widget.controller),
            _ => CustomerHomeScreen(
              home: home,
              userName: authenticated ? widget.controller.user!.name : '',
              onOrders: showOrders,
              onConsult: () => selectTab(2),
              onProduct: (product) =>
                  openDetail(product, promotionId: home.selectedPromotion?.id),
              onBrowse: openProducts,
            ),
          },
        ),
        bottomNavigationBar:
            tab == 3 || MediaQuery.viewInsetsOf(context).bottom > 0
            ? null
            : CustomerNavigation(
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

// Bảo vệ các trang Navigator con khi phiên/role thay đổi, không để trang mua của phiên cũ nằm trên login.
class _CustomerRoute extends StatelessWidget {
  const _CustomerRoute({
    required this.controller,
    required this.userId,
    required this.child,
  });
  final AuthController controller;
  final int? userId;
  final Widget child;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      if ((userId == null && controller.stage != AuthStage.authenticated) ||
          (controller.stage == AuthStage.authenticated &&
              controller.user?.role == AppRole.customer &&
              controller.user?.id == userId)) {
        return child;
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) {
          Navigator.of(context).popUntil((route) => route.isFirst);
        }
      });
      return const SizedBox.shrink();
    },
  );
}

// Trang đăng nhập mở từ hộp thoại; thành công đóng các route phụ để router chọn đúng vai trò.
class _LoginRoute extends StatelessWidget {
  const _LoginRoute({required this.controller});
  final AuthController controller;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      if (controller.stage == AuthStage.authenticated) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) {
            Navigator.of(context).popUntil((route) => route.isFirst);
          }
        });
        return const SizedBox.shrink();
      }
      return Scaffold(
        backgroundColor: CustomerShellColors.loginBackground,
        appBar: AppBar(
          backgroundColor: CustomerShellColors.loginHeaderBackground,
          iconTheme: const IconThemeData(
            color: CustomerShellColors.loginBackIcon,
          ),
          title: const Text(
            'Đăng nhập',
            style: TextStyle(color: CustomerShellColors.loginHeaderTitle),
          ),
        ),
        body: LoginScreen(controller: controller),
      );
    },
  );
}
