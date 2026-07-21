import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/bookmarks_provider.dart';

class BookmarksScreen extends StatelessWidget {
  const BookmarksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final bookmarks = context.watch<BookmarksProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Bookmarks')),
      body: bookmarks.ids.isEmpty
          ? const Center(child: Text('No bookmarked stories yet.'))
          : ListView.builder(
              itemCount: bookmarks.ids.length,
              itemBuilder: (context, index) {
                final id = bookmarks.ids[index];
                return ListTile(title: Text('Story $id'), subtitle: const Text('Saved locally for offline reading'));
              },
            ),
    );
  }
}
