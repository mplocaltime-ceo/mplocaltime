import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class UserProvider extends ChangeNotifier {
  Map<String, dynamic>? _profile;
  bool _loading = false;

  Map<String, dynamic>? get profile => _profile;
  bool get loading => _loading;

  Future<void> loadProfile(String token) async {
    _loading = true;
    notifyListeners();

    final response = await http.get(
      Uri.parse('http://10.0.2.2:3000/api/users/me'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      _profile = payload['user'] as Map<String, dynamic>?;
    }

    _loading = false;
    notifyListeners();
  }
}
