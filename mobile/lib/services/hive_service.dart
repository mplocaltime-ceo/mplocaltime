import 'package:hive/hive.dart';

class HiveService {
  static const String _bookmarksBox = 'bookmarks';
  static const String _commentsBox = 'comments';

  static Future<void> initialize() async {
    await Hive.openBox<String>(_bookmarksBox);
    await Hive.openBox<Map>(_commentsBox);
  }

  static Box<String> bookmarksBox() => Hive.box<String>(_bookmarksBox);

  static Box<Map> commentsBox() => Hive.box<Map>(_commentsBox);
}
