import 'package:flutter/foundation.dart';

import '../../core/network/api.dart';
import '../../core/network/api_exception.dart';
import '../../models/catalog.dart';

// State riêng của trang danh sách: query, hai bộ lọc và phân trang không trộn vào trang chủ.
class CustomerProductsController extends ChangeNotifier {
  CustomerProductsController(
    this.api, {
    this.search = '',
    this.categoryId,
    List<CatalogCategory> categories = const [],
  }) : categories = List.of(categories);
  final CatalogApi api;
  String search;
  int? categoryId;
  bool? prescription;
  List<CatalogCategory> categories;
  List<CatalogProduct> items = [];
  bool loading = false, categoriesLoading = false;
  String? error, categoriesError;
  int page = 1, pages = 0, total = 0;
  int _version = 0;
  bool _disposed = false;
  void _emit() {
    if (!_disposed) notifyListeners();
  }

  Future<void> initialize() =>
      Future.wait([load(), if (categories.isEmpty) loadCategories()]);
  Future<void> loadCategories() async {
    if (categoriesLoading) return;
    categoriesLoading = true;
    categoriesError = null;
    _emit();
    try {
      final records = <CatalogCategory>[];
      var index = 1, last = 1;
      do {
        final data = await api.categories(page: index);
        if (_disposed) return;
        records.addAll(data.items);
        last = data.pages;
        index++;
      } while (index <= last);
      categories = records;
    } on ApiException catch (failure) {
      categoriesError = failure.message;
    } finally {
      categoriesLoading = false;
      _emit();
    }
  }

  Future<void> load({int requestedPage = 1}) async {
    final version = ++_version;
    loading = true;
    error = null;
    items = [];
    page = requestedPage;
    _emit();
    if (search.runes.length > 255 || search.contains('\u0000')) {
      error = 'Nhập từ khóa tối đa 255 ký tự.';
      loading = false;
      _emit();
      return;
    }
    try {
      final data = await api.products(
        search: search.trim(),
        categoryId: categoryId,
        prescription: prescription,
        includeOffers: true,
        page: requestedPage,
      );
      if (_disposed || version != _version) return;
      if (requestedPage > 1 && requestedPage > data.pages) {
        await load(requestedPage: data.pages > 0 ? data.pages : 1);
        return;
      }
      items = data.items;
      pages = data.pages;
      total = data.total;
    } on ApiException catch (failure) {
      if (version == _version) error = failure.message;
    } finally {
      if (version == _version) {
        loading = false;
        _emit();
      }
    }
  }

  Future<void> updateSearch(String value) {
    search = value.trim();
    return load();
  }

  Future<void> filterCategory(int? value) {
    categoryId = value;
    return load();
  }

  Future<void> filterPrescription(bool? value) {
    prescription = value;
    return load();
  }

  @override
  void dispose() {
    _disposed = true;
    _version++;
    super.dispose();
  }
}
