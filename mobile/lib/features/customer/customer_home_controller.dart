import 'package:flutter/foundation.dart';

import '../../core/network/api.dart';
import '../../core/network/api_exception.dart';
import '../../models/catalog.dart';

// Tải từng khối độc lập; một khối lỗi không che toàn bộ trang chủ.
class CustomerHomeController extends ChangeNotifier {
  CustomerHomeController(this.api);
  final CatalogApi api;
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
      Future.wait([loadCategories(), loadPromotions()]);

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
    super.dispose();
  }
}
