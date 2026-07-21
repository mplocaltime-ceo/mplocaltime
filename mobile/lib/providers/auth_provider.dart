import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider(this._preferences);

  final SharedPreferences _preferences;

  String? _token;
  String? _username;
  String? _role;

  bool get isAuthenticated => (_token ?? '').isNotEmpty;
  String? get token => _token;
  String? get username => _username;
  String? get role => _role;

  Future<void> loadSession() async {
    _token = _preferences.getString('auth_token');
    _username = _preferences.getString('auth_username');
    _role = _preferences.getString('auth_role');
    notifyListeners();
  }

  Future<bool> login({required String username, required String password}) async {
    final response = await http.post(
      Uri.parse('http://10.0.2.2:3000/api/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );

    if (response.statusCode != 200) {
      return false;
    }

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    _token = payload['token']?.toString();
    _username = payload['username']?.toString();
    _role = payload['role']?.toString();

    await _preferences.setString('auth_token', _token ?? '');
    await _preferences.setString('auth_username', _username ?? '');
    await _preferences.setString('auth_role', _role ?? '');
    notifyListeners();
    return true;
  }

  Future<void> logout() async {
    _token = null;
    _username = null;
    _role = null;
    await _preferences.remove('auth_token');
    await _preferences.remove('auth_username');
    await _preferences.remove('auth_role');
    notifyListeners();
  }
}
