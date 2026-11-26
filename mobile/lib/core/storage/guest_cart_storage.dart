import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'session_storage.dart';

// Chỉ lưu giỏ khách; Web dùng localStorage của plugin, native dùng kho cục bộ.
// JWT Web vẫn chỉ nằm trong RAM, không dùng kho này.
class GuestCartStorage {
  GuestCartStorage(this.store);
  factory GuestCartStorage.local(String baseUrl) =>
      GuestCartStorage(_LocalCartStore(baseUrl));
  final TokenStore store;

  Future<Map<String, dynamic>> read() async {
    final raw = await store.read();
    if (raw == null) return {'items': <dynamic>[]};
    final value = jsonDecode(raw);
    if (value is! Map<String, dynamic> || value['items'] is! List) {
      throw const FormatException('Giỏ cục bộ không hợp lệ');
    }
    return value;
  }

  Future<void> save(Map<String, dynamic> value) =>
      store.write(jsonEncode(value));
  static String newId() {
    final random = Random.secure();
    return List.generate(
      16,
      (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
    ).join();
  }
}

class _LocalCartStore implements TokenStore {
  _LocalCartStore(String baseUrl)
    : key = 'lanyen.guest-cart.v1.${Uri.encodeComponent(baseUrl)}';
  final String key;
  final storage = const FlutterSecureStorage();
  @override
  Future<String?> read() => storage.read(key: key);
  @override
  Future<void> write(String value) => storage.write(key: key, value: value);
  @override
  Future<void> clear() => storage.delete(key: key);
}
