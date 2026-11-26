import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'customer_home_controller.dart';
import 'customer_components.dart';

class CustomerCartColors {
  CustomerCartColors._();
  // Nền toàn trang và thanh tiêu đề phía trên.
  static const pageBackground = AppColors.background;
  // Chữ tiêu đề trang và mũi tên quay lại ở AppBar.
  static const appBarForeground = AppColors.textPrimary;
  // Chữ tiêu đề của trang giỏ hàng.
  static const cartTitle = AppColors.textPrimary;

  // Chữ số sản phẩm của trang giỏ hàng.
  static const cartCount = AppColors.primaryDark;

  // Màu hiển thị của trang giỏ hàng.
  static const cartStockWarning = AppColors.error;

  // Chữ tên sản phẩm của trang giỏ hàng.
  static const cartName = AppColors.textPrimary;

  // Màu hiển thị của trang giỏ hàng.
  static const cartQuantity = AppColors.textPrimary;

  // Đường phân cách của trang giỏ hàng.
  static const cartDivider = AppColors.border;

  // Chữ/biểu tượng của trang giỏ hàng.
  static const cartRefreshForeground = AppColors.primary;

  // Màu nền của trang giỏ hàng. Null giữ nguyên màu Theme/SDK.
  static const Color? cartRefreshBackground = null;
}

// Trang Giỏ hàng riêng, dùng cùng state giỏ JWT của khung khách hàng.
class CustomerCartScreen extends StatelessWidget {
  const CustomerCartScreen({super.key, required this.home});
  final CustomerHomeController home;
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: CustomerCartColors.pageBackground,
    appBar: AppBar(
      backgroundColor: CustomerCartColors.pageBackground,
      foregroundColor: CustomerCartColors.appBarForeground,
      title: const Text('Giỏ hàng'),
    ),
    body: _CartContent(home: home),
  );
}

// Các dòng sản phẩm đã lưu trong giỏ hàng.
class _CartContent extends StatelessWidget {
  const _CartContent({required this.home});
  final CustomerHomeController home;
  @override
  Widget build(BuildContext context) => RefreshIndicator(
    color: CustomerCartColors.cartRefreshForeground,
    backgroundColor: CustomerCartColors.cartRefreshBackground,
    onRefresh: home.loadCart,
    child: ListView(
      key: const ValueKey('customer-cart'),
      padding: const EdgeInsets.all(24),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 8),
        if (home.cartLoading)
          const CustomerStatus(loading: true)
        else if (home.cartError != null)
          CustomerStatus(message: home.cartError!, onRetry: home.loadCart)
        else if (home.cart?.items.isEmpty ?? true)
          const CustomerStatus(message: 'Giỏ hàng chưa có sản phẩm.')
        else ...[
          Text(
            '${home.cart!.productCount} sản phẩm',
            style: const TextStyle(color: CustomerCartColors.cartCount),
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
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: CustomerCartColors.cartName,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.quantity} ${item.unit}',
                    style: const TextStyle(
                      color: CustomerCartColors.cartQuantity,
                    ),
                  ),
                  if (!item.available)
                    const Text(
                      'Cần kiểm tra lại tồn kho',
                      style: TextStyle(
                        color: CustomerCartColors.cartStockWarning,
                      ),
                    ),
                  const SizedBox(height: 12),
                  const Divider(color: CustomerCartColors.cartDivider),
                ],
              ),
            ),
          ),
        ],
      ],
    ),
  );
}
