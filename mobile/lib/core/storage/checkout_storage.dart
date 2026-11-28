import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'session_storage.dart';

// Chỉ lưu mã yêu cầu theo tài khoản để khôi phục khi mất phản hồi; không lưu JWT/địa chỉ/ghi chú.
class CheckoutStorage {
  const CheckoutStorage(this.store, this.userId);
  final TokenStore store;
  final int userId;
  Future<String?> read() async {
    final raw = await store.read();
    if (raw == null) return null;
    final data = jsonDecode(raw);
    if (data is! Map<String, dynamic>) throw const FormatException();
    final value = data['$userId'];
    if (value == null) return null;
    if (value is! String || !RegExp(r'^[a-f0-9-]{36}$').hasMatch(value)) {
      throw const FormatException();
    }
    return value;
  }

  Future<void> save(String? id) async {
    final raw = await store.read();
    final data = raw == null
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(jsonDecode(raw) as Map);
    if (id == null) {
      data.remove('$userId');
    } else {
      data['$userId'] = id;
    }
    await store.write(jsonEncode(data));
  }
}

class CheckoutTokenStore implements TokenStore {
  CheckoutTokenStore(String baseUrl)
    : key = 'lanyen.checkout-request.v1.${Uri.encodeComponent(baseUrl)}';
  final String key;
  final storage = const FlutterSecureStorage();
  @override
  Future<String?> read() => storage.read(key: key);
  @override
  Future<void> write(String value) => storage.write(key: key, value: value);
  @override
  Future<void> clear() => storage.delete(key: key);
}
