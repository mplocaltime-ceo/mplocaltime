import 'package:flutter_test/flutter_test.dart';
import 'package:mplocaltime_mobile/screens/login_screen.dart';

void main() {
  testWidgets('Login screen shows welcome text', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

    expect(find.text('Welcome back'), findsOneWidget);
  });
}
