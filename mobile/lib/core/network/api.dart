import '../../models/auth_session.dart';
import '../../models/session_user.dart';
import '../../models/catalog.dart';
import 'api_client.dart';
import 'api_exception.dart';

// ============================================================
// API XÁC THỰC MOBILE JWT — không sử dụng /api/auth của Website.
// ============================================================
class AuthApi {
  const AuthApi(this.client);
  final ApiClient client;

  Future<void> _clearSession() async {
    try {
      await client.session.clear();
    } on Exception {
      throw const ApiException(ApiFailure.storage);
    }
  }

  T _parse<T>(T Function() parser) {
    try {
      return parser();
    } on FormatException {
      throw const ApiException(ApiFailure.response);
    }
  }

  Future<OtpDelivery> requestOtp(String phone) async {
    final data = await client.post('mobile/auth/otp/request', {'phone': phone});
    return _parse(() => OtpDelivery.fromJson(data));
  }

  Future<AuthResult> verifyOtp(String challenge, String otp) async {
    final data = await client.post('mobile/auth/otp/verify', {
      'challenge_token': challenge,
      'otp': otp,
    });
    return _accept(data);
  }

  Future<AuthResult> register(String registrationToken, String name) async {
    final data = await client.post('mobile/auth/register', {
      'registration_token': registrationToken,
      'ho_ten': name,
    });
    return _accept(data);
  }

  Future<AuthResult> _accept(Map<String, dynamic> data) async {
    final result = _parse(() => AuthResult.fromJson(data));
    if (result.tokens != null) {
      try {
        await client.session.save(result.tokens!);
      } on Exception {
        throw const ApiException(ApiFailure.storage);
      }
    }
    return result;
  }

  Future<SessionUser> readSession() async {
    final data = await client.get('mobile/auth/me', authorized: true);
    return _parse(() {
      if (data['code'] != 'AUTHENTICATED' ||
          data['user'] is! Map<String, dynamic>) {
        throw const FormatException();
      }
      return SessionUser.fromJson(data['user'] as Map<String, dynamic>);
    });
  }

  Future<SessionUser?> restoreSession() async {
    try {
      await client.session.load();
    } on Exception {
      throw const ApiException(ApiFailure.storage);
    }
    if (client.session.tokens == null) return null;
    try {
      return await readSession();
    } on ApiException catch (error) {
      if (error.code == 'TOKEN_EXPIRED') {
        try {
          await refresh();
          return await readSession();
        } on ApiException catch (refreshError) {
          if (refreshError.status == 401 || refreshError.status == 403) {
            await _clearSession();
          }
          rethrow;
        }
      }
      if (error.status == 401 || error.status == 403) {
        await _clearSession();
      }
      rethrow;
    }
  }

  Future<void> refresh() async {
    final refresh = client.session.tokens?.refreshToken;
    if (refresh == null) throw const ApiException(ApiFailure.authentication);
    final data = await client.post('mobile/auth/refresh', {
      'refresh_token': refresh,
    });
    await _accept(data);
  }

  Future<void> logout() async {
    final token = client.session.tokens?.refreshToken;
    if (token == null) {
      await _clearSession();
      return;
    }
    try {
      final result = await client.post('mobile/auth/logout', {
        'refresh_token': token,
      });
      if (result['code'] != 'LOGGED_OUT') {
        throw const ApiException(ApiFailure.response);
      }
    } on ApiException catch (error) {
      if (error.status != 401) rethrow;
    }
    await _clearSession();
  }
}

// Danh mục dùng lại nghiệp vụ công khai của Website qua CORS riêng cho Mobile.
class CatalogApi {
  const CatalogApi(this.client);
  final ApiClient client;

  Future<CatalogPage<T>> _list<T>(
    String path,
    String code,
    T Function(Map<String, dynamic>) parse,
    int page,
    Map<String, String> filters,
  ) async {
    final data = await client.get(
      'mobile/catalog/$path',
      queryParameters: {'page': '$page', ...filters},
    );
    try {
      return CatalogPage.parse(data, code, parse, page);
    } on FormatException {
      throw const ApiException(ApiFailure.response);
    }
  }

  Future<CatalogPage<CatalogCategory>> categories({int page = 1}) => _list(
    'categories',
    'CATEGORIES_LISTED',
    CatalogCategory.fromJson,
    page,
    {'per_page': '100'},
  );
  Future<CatalogPage<CatalogPromotion>> promotions({int page = 1}) => _list(
    'promotions',
    'PROMOTIONS_LISTED',
    CatalogPromotion.fromJson,
    page,
    {'per_page': '100'},
  );
  Future<CatalogPage<CatalogProduct>> promotionProducts(
    int id, {
    int page = 1,
  }) => _list(
    'promotions/$id/products',
    'PROMOTION_PRODUCTS_LISTED',
    CatalogProduct.fromJson,
    page,
    {'per_page': '12'},
  );
  Future<CatalogPage<CatalogProduct>> products({
    String search = '',
    int? categoryId,
    int page = 1,
  }) => _list('products', 'PRODUCTS_LISTED', CatalogProduct.fromJson, page, {
    'per_page': '12',
    if (search.isNotEmpty) 'search': search,
    if (categoryId != null) 'category_id': '$categoryId',
  });
  Future<CatalogProduct> product(int id) async {
    final data = await client.get('mobile/catalog/products/$id');
    try {
      if (data['code'] != 'PRODUCT_FOUND' ||
          data['product'] is! Map<String, dynamic>) {
        throw const FormatException();
      }
      return CatalogProduct.fromJson(data['product'] as Map<String, dynamic>);
    } on FormatException {
      throw const ApiException(ApiFailure.response);
    }
  }
}
