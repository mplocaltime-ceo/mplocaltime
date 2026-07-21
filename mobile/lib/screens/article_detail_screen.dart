import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/bookmarks_provider.dart';
import '../providers/comments_provider.dart';

class ArticleDetailScreen extends StatefulWidget {
  const ArticleDetailScreen({super.key, this.story});

  final Map<String, dynamic>? story;

  @override
  State<ArticleDetailScreen> createState() => _ArticleDetailScreenState();
}

class _ArticleDetailScreenState extends State<ArticleDetailScreen> {
  late final Map<String, dynamic> _story;
  final TextEditingController _commentController = TextEditingController();
  bool _loading = false;
  List<Map<String, dynamic>> _comments = [];

  @override
  void initState() {
    super.initState();
    _story = Map<String, dynamic>.from(widget.story ?? {});
    _loadStory();
  }

  Future<void> _loadStory() async {
    if (_story['id'] == null) return;
    setState(() => _loading = true);
    final response = await http.get(Uri.parse('http://10.0.2.2:3000/api/stories/${_story['id']}'));
    if (!mounted) return;
    if (response.statusCode == 200) {
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      setState(() {
        _story.addAll(Map<String, dynamic>.from(payload['story'] ?? {}));
        _comments = (payload['comments'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
      });
    }
    setState(() => _loading = false);
  }

  Future<void> _submitComment() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated || _commentController.text.trim().isEmpty) return;

    setState(() => _loading = true);
    await context.read<CommentsProvider>().addComment(
      _story['id'].toString(),
      auth.token!,
      _commentController.text.trim(),
    );
    _commentController.clear();
    await _loadStory();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Comment posted')));
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bookmarks = context.watch<BookmarksProvider>();
    final isBookmarked = bookmarks.isBookmarked(_story['id']?.toString() ?? '');

    return Scaffold(
      appBar: AppBar(
        title: Text(_story['title']?.toString() ?? 'Article'),
        actions: [
          IconButton(
            icon: Icon(isBookmarked ? Icons.bookmark : Icons.bookmark_border),
            onPressed: () => bookmarks.toggle(_story['id']?.toString() ?? ''),
          ),
        ],
      ),
      body: _loading && _story.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _story['title']?.toString() ?? 'Untitled story',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Chip(label: Text(_story['category']?.toString() ?? 'News')),
                      const SizedBox(width: 8),
                      if (_story['author'] != null) Text('By ${_story['author']}'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(_story['content']?.toString() ?? _story['excerpt']?.toString() ?? ''),
                  const SizedBox(height: 24),
                  const Text('Comments', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _commentController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'Share your thoughts',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton(onPressed: _submitComment, child: const Text('Post comment')),
                  ),
                  const SizedBox(height: 16),
                  if (_comments.isEmpty)
                    const Text('No comments yet. Be the first to share your view.')
                  else
                    ..._comments.map(
                      (comment) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text(comment['author']?.toString() ?? 'Guest'),
                          subtitle: Text(comment['text']?.toString() ?? ''),
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
