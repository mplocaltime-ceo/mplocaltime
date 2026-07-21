import 'package:firebase_core/firebase_core.dart';

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    return FirebaseOptions(
      apiKey: const String.fromEnvironment('FIREBASE_API_KEY', defaultValue: 'YOUR_FIREBASE_API_KEY'),
      appId: const String.fromEnvironment('FIREBASE_APP_ID', defaultValue: 'YOUR_FIREBASE_APP_ID'),
      messagingSenderId: const String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID', defaultValue: 'YOUR_FIREBASE_MESSAGING_SENDER_ID'),
      projectId: const String.fromEnvironment('FIREBASE_PROJECT_ID', defaultValue: 'YOUR_FIREBASE_PROJECT_ID'),
      authDomain: const String.fromEnvironment('FIREBASE_AUTH_DOMAIN', defaultValue: 'YOUR_FIREBASE_AUTH_DOMAIN'),
      storageBucket: const String.fromEnvironment('FIREBASE_STORAGE_BUCKET', defaultValue: 'YOUR_FIREBASE_STORAGE_BUCKET'),
      measurementId: const String.fromEnvironment('FIREBASE_MEASUREMENT_ID', defaultValue: ''),
    );
  }
}
