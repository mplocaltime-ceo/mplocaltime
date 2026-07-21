import 'package:flutter/material.dart';

import '../services/hive_service.dart';

class BookmarksProvider extends ChangeNotifier {
  List<String> _ids = [];

  BookmarksProvider() {
    _ids = HiveService.bookmarksBox().values.toList();
  }

  List<String> get ids => _ids;

  bool isBookmarked(String id) => _ids.contains(id);

  Future<void> toggle(String id) async {
    if (_ids.contains(id)) {
      _ids.remove(id);
      await HiveService.bookmarksBox().delete(id);
    } else {
      _ids.add(id);
      await HiveService.bookmarksBox().put(id, id);
    }
    notifyListeners();
  }
}
