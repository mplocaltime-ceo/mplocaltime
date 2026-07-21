import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mplocaltime_mobile/screens/article_detail_screen.dart';

void main() {
  testWidgets('Article detail screen shows title and comments heading', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ArticleDetailScreen(
          story: {
            'id': 1,
            'title': 'New clinic opens',
            'excerpt': 'A new clinic is helping residents get faster appointments.',
            'content': 'A new clinic is helping residents get faster appointments.',
            'category': 'Health',
          },
        ),
      ),
    );

    expect(find.text('New clinic opens'), findsOneWidget);
    expect(find.text('Comments'), findsOneWidget);
  });
}
