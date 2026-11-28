import 'package:flutter/foundation.dart';

import 'dart:async';

import '../../core/network/api.dart';
import '../../core/network/api_exception.dart';
import '../../models/catalog.dart';
import '../../models/customer_cart.dart';
import '../../core/storage/guest_cart_storage.dart';

// Tải từng khối độc lập; một khối lỗi không che toàn bộ trang chủ.
class CustomerHomeController extends ChangeNotifier {
  CustomerHomeController(
    this.api, {
    this.cartApi,
    this.guestCart,
    this.customerId,
    DateTime Function()? now,
  }) : now = now ?? DateTime.now {
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
  final GuestCartStorage? guestCart;
  int? customerId;
  int _cartVersion = 0;
  Future<void>? _cartWrite;
  // Thay chủ giỏ sẽ bỏ ngay dữ liệu tài khoản trước, không ghi giỏ tài khoản vào kho khách.
  Future<void> changeCustomer(int? id) async {
    customerId = id;
    _cartVersion++;
    cart = null;
    cartError = null;
    _emit();
    if (_cartWrite != null) await _cartWrite;
    if (_cartRequest != null) await _cartRequest;
    if (!_disposed) await loadCart();
  }

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
    if (_disposed) return;
    final version = _cartVersion;
    final owner = customerId;
    var readingAccountCart = false;
    cartLoading = true;
    cartError = null;
    _emit();
    try {
      CustomerCart value;
      if (guestCart != null && owner == null) {
        final data = await guestCart!.read();
        value = CustomerCart(
          List.unmodifiable(
            (data['items'] as List).map(
              (item) =>
                  CartLine.fromJson(Map<String, dynamic>.from(item as Map)),
            ),
          ),
        );
      } else {
        if (cartApi == null) return;
        if (guestCart != null) {
          final data = await guestCart!.read();
          if (version != _cartVersion || _disposed) return;
          while (data['pending'] != null ||
              (data['items'] as List).isNotEmpty) {
            if (version != _cartVersion || _disposed) return;
            var pending = data['pending'] as Map<String, dynamic>?;
            if (pending == null && (data['items'] as List).isNotEmpty) {
              pending = {
                'owner': owner,
                // Mã chỉ thuộc payload đã đóng băng, không dùng lại mã giỏ khách cũ.
                'merge_id': GuestCartStorage.newId(),
                'created_at': DateTime.now().millisecondsSinceEpoch ~/ 1000,
                'items': data['items'],
              };
              data['pending'] = pending;
              data.remove('batch_id');
              data['items'] = <dynamic>[];
              await guestCart!.save(data);
            }
            if (pending != null) {
              // Ghi kho có await: phiên có thể đã đổi trong lúc lưu batch.
              if (_disposed || version != _cartVersion) return;
              if (pending['owner'] != owner) {
                throw const ApiException(
                  ApiFailure.forbidden,
                  code: 'CART_MERGE_OWNER_CHANGED',
                );
              }
              await cartApi!.merge({
                'merge_id': pending['merge_id'],
                'created_at': pending['created_at'],
                'items': (pending['items'] as List)
                    .map(
                      (item) => {
                        'MaThuoc': item['MaThuoc'],
                        'MaDonGia': item['MaDonGia'],
                        'SoLuong': item['SoLuong'],
                      },
                    )
                    .toList(),
              });
              // Chỉ xóa bản chờ sau xác nhận. Giữ nguyên merge_id nếu mất mạng/ghi kho thất bại.
              data.remove('pending');
              await guestCart!.save(data);
            }
          }
        }
        if (_disposed || version != _cartVersion) return;
        readingAccountCart = true;
        value = await cartApi!.read();
      }
      if (!_disposed && version == _cartVersion) cart = value;
    } on ApiException catch (error) {
      if (version == _cartVersion) {
        cartError = switch (error.code) {
          'CART_MERGE_PENDING' => 'Chưa xác định được kết quả đồng bộ. Giỏ khách vẫn được giữ; vui lòng liên hệ nhà thuốc trước khi thêm lại.',
          'CART_MERGE_EXPIRED' => 'Giỏ chờ đồng bộ đã quá hạn. Dữ liệu vẫn được giữ; vui lòng liên hệ nhà thuốc để đối chiếu.',
          'CART_MERGE_OWNER_CHANGED' => 'Giỏ khách đang chờ đồng bộ với tài khoản trước. Vui lòng đăng nhập lại tài khoản đó.',
          'OUT_OF_STOCK' => 'Có sản phẩm không còn đủ hàng. Giỏ khách vẫn được giữ để kiểm tra lại.',
          'UNIT_NOT_FOUND' || 'UNIT_UNAVAILABLE' =>
            'Đơn vị bán đã thay đổi. Giỏ khách vẫn được giữ để kiểm tra lại.',
          'CONSULTATION_REQUIRED' =>
            'Có sản phẩm cần dược sĩ tư vấn. Giỏ khách vẫn được giữ.',
          _ =>
            'Chưa thể tải hoặc đồng bộ giỏ hàng. Giỏ khách vẫn được giữ. ${error.message}',
        };
        if (owner != null && !readingAccountCart) {
          await _readAccountCartAfterSyncFailure(version);
        }
      }
    } on Exception {
      if (version == _cartVersion) {
        cartError = 'Chưa thể đọc hoặc lưu giỏ trên thiết bị. Dữ liệu chưa được xóa. Vui lòng thử lại.';
        if (owner != null && !readingAccountCart) {
          await _readAccountCartAfterSyncFailure(version);
        }
      }
    } finally {
      cartLoading = false;
      _emit();
    }
  }

  // Lỗi giỏ khách không che giỏ đã lưu của tài khoản; vẫn giữ cảnh báo đồng bộ.
  Future<void> _readAccountCartAfterSyncFailure(int version) async {
    if (_disposed || version != _cartVersion || cartApi == null) return;
    try {
      final value = await cartApi!.read();
      if (!_disposed && version == _cartVersion) cart = value;
    } on ApiException catch (failure) {
      if (!_disposed && version == _cartVersion) {
        cartError =
            '$cartError Chưa tải được giỏ tài khoản. ${failure.message}';
      }
    } on Exception {
      if (!_disposed && version == _cartVersion) {
        cartError = '$cartError Chưa tải được giỏ tài khoản. Vui lòng thử lại.';
      }
    }
  }

  Future<bool> addToCart(CatalogProduct product, CatalogPrice price) async {
    if ((cartApi == null && guestCart == null) ||
        adding ||
        cartLoading ||
        product.consultation ||
        !price.available) {
      return false;
    }
    if (product.upcomingOffer || (product.hasOffer && price.quota <= 0)) {
      return false;
    }
    adding = true;
    addingProductId = product.id;
    purchaseMessage = null;
    _emit();
    final version = _cartVersion;
    final completer = Completer<void>();
    _cartWrite = completer.future;
    try {
      if (guestCart != null && customerId == null) {
        final data = await guestCart!.read();
        final entries = (data['items'] as List).cast<Map<String, dynamic>>();
        final index = entries.indexWhere(
          (item) =>
              item['MaDonGia'] == price.id && item['MaThuoc'] == product.id,
        );
        if (index >= 0) {
          entries[index]['SoLuong'] = (entries[index]['SoLuong'] as int) + 1;
        } else {
          if (entries.length >= 50) {
            purchaseMessage = 'Giỏ khách tối đa 50 đơn vị sản phẩm. Vui lòng đăng nhập để tiếp tục.';
            return false;
          }
          entries.add({
            'MaThuoc': product.id,
            'MaDonGia': price.id,
            'SoLuong': 1,
            'TenThuoc': product.name,
            'DonViTinh': price.unit,
            'ConHang': price.available,
          });
        }
        data['items'] = entries;
        await guestCart!.save(data);
      } else {
        if (cartError != null) {
          purchaseMessage = 'Vui lòng tải và đồng bộ giỏ hàng thành công trước khi thêm sản phẩm.';
          return false;
        }
        await cartApi!.add(product.id, price.id);
      }
      if (_disposed || version != _cartVersion) return true;
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
    } on Exception {
      purchaseMessage = 'Không thể lưu giỏ trên thiết bị. Sản phẩm chưa được xác nhận đã thêm.';
      return false;
    } finally {
      completer.complete();
      _cartWrite = null;
      adding = false;
      addingProductId = null;
      _emit();
    }
  }

  // Chỉnh giỏ theo chủ hiện tại: giỏ khách chỉ ghi thiết bị; tài khoản dùng JWT.
  Future<bool> editCart(
    CartLine line,
    int quantity, {
    int? destinationId,
  }) async {
    if (_disposed || adding || cartLoading || quantity < 0) return false;
    if (customerId != null && cartError != null) return false;
    final version = _cartVersion;
    final target = destinationId ?? line.unitId;
    adding = true;
    purchaseMessage = null;
    final completion = Completer<void>();
    _cartWrite = completion.future;
    _emit();
    try {
      if (guestCart != null && customerId == null) {
        final data = await guestCart!.read();
        final entries = (data['items'] as List).cast<Map<String, dynamic>>();
        final index = entries.indexWhere(
          (item) =>
              item['MaDonGia'] == line.unitId &&
              item['MaThuoc'] == line.productId,
        );
        if (index < 0) return false;
        final source = Map<String, dynamic>.from(entries.removeAt(index));
        if (quantity > 0) {
          final duplicate = entries
              .where(
                (item) =>
                    item['MaDonGia'] == target &&
                    item['MaThuoc'] == line.productId,
              )
              .firstOrNull;
          if (duplicate != null) {
            duplicate['SoLuong'] = (duplicate['SoLuong'] as int) + quantity;
          } else {
            source['SoLuong'] = quantity;
            source['MaDonGia'] = target;
            final unit = line.units
                .where((i) => i['MaDonGia'] == target)
                .firstOrNull;
            if (unit != null) source['DonViTinh'] = unit['DonViTinh'];
            entries.add(source);
          }
        }
        data['items'] = entries;
        await guestCart!.save(data);
      } else {
        if (cartApi == null) return false;
        if (quantity == 0) {
          await cartApi!.remove(line.unitId);
        } else {
          await cartApi!.update(line.unitId, target, quantity);
        }
      }
      if (version != _cartVersion || _disposed) return true;
      purchaseMessage = quantity == 0
          ? 'Đã xóa sản phẩm khỏi giỏ hàng.'
          : 'Đã cập nhật giỏ hàng.';
      if (_cartRequest != null) await _cartRequest;
      await loadCart();
      return true;
    } on ApiException catch (failure) {
      purchaseMessage = failure.code == 'OUT_OF_STOCK'
          ? 'Số lượng vượt tồn kho hiện tại.'
          : '${failure.message} Vui lòng tải lại giỏ để kiểm tra trước khi thử lại.';
      return false;
    } on Exception {
      purchaseMessage =
          'Chưa thể lưu thay đổi vào giỏ trên thiết bị. Vui lòng thử lại.';
      return false;
    } finally {
      completion.complete();
      _cartWrite = null;
      adding = false;
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
