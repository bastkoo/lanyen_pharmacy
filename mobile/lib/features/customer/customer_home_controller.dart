import 'package:flutter/foundation.dart';

import 'dart:async';

import '../../core/network/api.dart';
import '../../core/network/api_exception.dart';
import '../../models/catalog.dart';
import '../../models/customer_cart.dart';

// Tải từng khối độc lập; một khối lỗi không che toàn bộ trang chủ.
class CustomerHomeController extends ChangeNotifier {
  CustomerHomeController(this.api, {this.cartApi, DateTime Function()? now})
    : now = now ?? DateTime.now {
    clock = ValueNotifier(this.now());
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      final previous = clock.value;
      clock.value = this.now();
      // Đồng bộ lại giá ở mốc bắt đầu/kết thúc, không giữ nút mua của ưu đãi cũ.
      if (promotions.any(
        (item) => item.stateAt(previous) != item.stateAt(clock.value),
      )) {
        loadPromotions();
      }
    });
  }
  final CatalogApi api;
  final CartApi? cartApi;
  final DateTime Function() now;
  late final ValueNotifier<DateTime> clock;
  late final Timer _timer;
  CustomerCart? cart;
  bool cartLoading = false, adding = false;
  String? cartError, purchaseMessage;
  int? addingProductId;
  Future<void>? _cartRequest;
  List<CatalogCategory> categories = [];
  List<CatalogPromotion> promotions = [];
  List<CatalogProduct> offers = [], results = [];
  CatalogPromotion? selectedPromotion;
  String? categoriesError, promotionsError, offersError, searchError;
  bool categoriesLoading = false,
      promotionsLoading = false,
      offersLoading = false,
      searchLoading = false,
      expandedCategories = false;
  bool browsing = false;
  String search = '';
  CatalogCategory? category;
  int offerPage = 1, offerPages = 0, resultPage = 1, resultPages = 0;
  int _offersVersion = 0, _searchVersion = 0;
  bool _disposed = false;
  void _emit() {
    if (!_disposed) notifyListeners();
  }

  Future<void> load() async =>
      Future.wait([loadCategories(), loadPromotions(), loadCart()]);

  Future<void> loadCart() =>
      _cartRequest ??= _readCart().whenComplete(() => _cartRequest = null);

  Future<void> _readCart() async {
    if (cartApi == null || _disposed) return;
    cartLoading = true;
    cartError = null;
    _emit();
    try {
      final value = await cartApi!.read();
      if (!_disposed) cart = value;
    } on ApiException catch (error) {
      cartError = error.message;
    } finally {
      cartLoading = false;
      _emit();
    }
  }

  Future<bool> addToCart(CatalogProduct product, CatalogPrice price) async {
    if (cartApi == null || adding || product.consultation || !price.available) {
      return false;
    }
    if (product.upcomingOffer || (product.hasOffer && price.quota <= 0)) {
      return false;
    }
    adding = true;
    addingProductId = product.id;
    purchaseMessage = null;
    _emit();
    try {
      await cartApi!.add(product.id, price.id);
      // POST thành công là đã lưu; đọc lại lỗi không được mời thêm trùng.
      purchaseMessage = 'Đã thêm sản phẩm vào giỏ hàng.';
      if (_cartRequest != null) await _cartRequest;
      await loadCart();
      return true;
    } on ApiException catch (error) {
      purchaseMessage = switch (error.code) {
        'CONSULTATION_REQUIRED' =>
          'Sản phẩm cần dược sĩ tư vấn. Vui lòng chọn Nhắn tin.',
        'OUT_OF_STOCK' => 'Sản phẩm vừa hết hàng. Vui lòng tải lại danh sách.',
        'UNIT_NOT_FOUND' || 'UNIT_UNAVAILABLE' =>
          'Đơn vị bán đã thay đổi. Vui lòng tải lại sản phẩm.',
        _ => '${error.message} Hãy kiểm tra giỏ hàng trước khi thêm lại.',
      };
      return false;
    } finally {
      adding = false;
      addingProductId = null;
      _emit();
    }
  }

  Future<void> loadCategories() async {
    if (categoriesLoading) return;
    categoriesLoading = true;
    categoriesError = null;
    _emit();
    try {
      final items = <CatalogCategory>[];
      var page = 1, pages = 1;
      do {
        final data = await api.categories(page: page);
        if (_disposed) return;
        items.addAll(data.items);
        pages = data.pages;
        page++;
      } while (page <= pages);
      categories = items;
    } on ApiException catch (error) {
      categoriesError = error.message;
    } finally {
      categoriesLoading = false;
      _emit();
    }
  }

  Future<void> loadPromotions() async {
    if (promotionsLoading) return;
    promotionsLoading = true;
    promotionsError = null;
    _offersVersion++;
    offers = [];
    selectedPromotion = null;
    _emit();
    try {
      final items = <CatalogPromotion>[];
      var page = 1, pages = 1;
      do {
        final data = await api.promotions(page: page);
        if (_disposed) return;
        items.addAll(data.items);
        pages = data.pages;
        page++;
      } while (page <= pages);
      promotions = items;
      if (items.isNotEmpty) {
        await selectPromotion(
          items.firstWhere((item) => item.active, orElse: () => items.first),
        );
      }
    } on ApiException catch (error) {
      promotionsError = error.message;
    } finally {
      promotionsLoading = false;
      _emit();
    }
  }

  Future<void> selectPromotion(
    CatalogPromotion promotion, {
    int page = 1,
  }) async {
    final version = ++_offersVersion;
    selectedPromotion = promotion;
    offersLoading = true;
    offersError = null;
    offers = [];
    offerPage = page;
    _emit();
    try {
      final data = await api.promotionProducts(promotion.id, page: page);
      if (_disposed || version != _offersVersion) return;
      offers = data.items;
      offerPages = data.pages;
    } on ApiException catch (error) {
      if (version == _offersVersion) offersError = error.message;
    } finally {
      if (version == _offersVersion) {
        offersLoading = false;
        _emit();
      }
    }
  }

  void toggleCategories() {
    expandedCategories = !expandedCategories;
    _emit();
  }

  Future<void> browse({
    String query = '',
    CatalogCategory? selectedCategory,
    int page = 1,
  }) async {
    final version = ++_searchVersion;
    browsing = true;
    search = query.trim();
    category = selectedCategory;
    searchLoading = true;
    searchError = null;
    results = [];
    resultPage = page;
    _emit();
    if (search.runes.length > 255 || search.contains('\u0000')) {
      searchError = 'Nhập từ khóa tối đa 255 ký tự.';
      searchLoading = false;
      _emit();
      return;
    }
    try {
      final data = await api.products(
        search: search,
        categoryId: category?.id,
        page: page,
      );
      if (_disposed || version != _searchVersion) return;
      results = data.items;
      resultPages = data.pages;
    } on ApiException catch (error) {
      if (version == _searchVersion) searchError = error.message;
    } finally {
      if (version == _searchVersion) {
        searchLoading = false;
        _emit();
      }
    }
  }

  void closeSearch() {
    _searchVersion++;
    browsing = false;
    searchLoading = false;
    _emit();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer.cancel();
    clock.dispose();
    super.dispose();
  }
}
