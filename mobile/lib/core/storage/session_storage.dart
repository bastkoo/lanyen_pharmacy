import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../models/auth_session.dart';

// Web chỉ giữ token trong RAM; không dùng localStorage/cookie cho JWT.
abstract interface class TokenStore {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> clear();
}

class MemoryTokenStore implements TokenStore {
  String? _value;
  @override
  Future<String?> read() async => _value;
  @override
  Future<void> write(String value) async => _value = value;
  @override
  Future<void> clear() async => _value = null;
}

// Android Keystore/iOS Keychain qua plugin; không lưu OTP hoặc họ tên.
class SecureTokenStore implements TokenStore {
  SecureTokenStore(String apiBaseUrl)
    : _key = 'lanyen.mobile.jwt.${Uri.encodeComponent(apiBaseUrl)}';
  final String _key;
  final _storage = const FlutterSecureStorage();
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);
  @override
  Future<void> clear() => _storage.delete(key: _key);
}

class SessionStorage {
  SessionStorage({TokenStore? store}) : _store = store ?? MemoryTokenStore();
  factory SessionStorage.forPlatform(String baseUrl) => SessionStorage(
    store: kIsWeb ? MemoryTokenStore() : SecureTokenStore(baseUrl),
  );
  final TokenStore _store;
  TokenPair? _tokens;
  TokenPair? get tokens => _tokens;

  Future<void> load() async {
    final value = await _store.read();
    if (value == null) return;
    try {
      final json = jsonDecode(value);
      if (json is! Map<String, dynamic>) throw const FormatException();
      _tokens = TokenPair.fromJson(json);
    } on FormatException {
      await clear();
    }
  }

  Future<void> save(TokenPair tokens) async {
    await _store.write(jsonEncode(tokens.toJson()));
    _tokens = tokens;
  }

  Future<void> clear() async {
    _tokens = null;
    await _store.clear();
  }
}
