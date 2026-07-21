import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../providers/bookmarks_provider.dart';
import '../providers/comments_provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Map<String, dynamic>> _stories = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadStories();
  }

  Future<void> _loadStories() async {
    final response = await http.get(Uri.parse('http://10.0.2.2:3000/api/breaking-news'));
    if (!mounted) return;
    if (response.statusCode == 200) {
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      setState(() {
        _stories = (payload['stories'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bookmarks = context.watch<BookmarksProvider>();
    final comments = context.watch<CommentsProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Breaking stories'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadStories,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _stories.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final story = _stories[index];
                final storyId = story['id'].toString();
                final bookmarked = bookmarks.isBookmarked(storyId);
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                story['title']?.toString() ?? 'Untitled story',
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                            ),
                            IconButton(
                              icon: Icon(bookmarked ? Icons.bookmark : Icons.bookmark_border),
                              onPressed: () => bookmarks.toggle(storyId),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(story['excerpt']?.toString() ?? story['content']?.toString() ?? ''),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Chip(label: Text(story['category']?.toString() ?? 'News')),
                            const Spacer(),
                            FutureBuilder<List<Map<String, dynamic>>>(
                              future: comments.loadComments(storyId),
                              builder: (context, snapshot) {
                                final count = snapshot.data?.length ?? 0;
                                return Text('$count comments');
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
