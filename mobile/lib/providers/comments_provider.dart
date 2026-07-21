import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../services/hive_service.dart';

class CommentsProvider extends ChangeNotifier {
  Future<List<Map<String, dynamic>>> loadComments(String storyId) async {
    final cached = HiveService.commentsBox().get(storyId);
    if (cached != null) {
      return List<Map<String, dynamic>>.from(cached['comments'] as List);
    }

    final response = await http.get(Uri.parse('http://10.0.2.2:3000/api/stories/$storyId'));
    if (response.statusCode != 200) {
      return [];
    }

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    final comments = (payload['comments'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    await HiveService.commentsBox().put(storyId, {'comments': comments});
    return comments;
  }

  Future<void> addComment(String storyId, String token, String text) async {
    final response = await http.post(
      Uri.parse('http://10.0.2.2:3000/api/stories/$storyId/comments'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'text': text}),
    );

    if (response.statusCode == 200) {
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      final comments = (payload['comments'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
      await HiveService.commentsBox().put(storyId, {'comments': comments});
      notifyListeners();
    }
  }
}
