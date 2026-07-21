# Mobile companion app

This directory contains a Flutter-based companion app for Mpumalanga Local Time.

## What is included
- Login screen connected to the existing backend at http://10.0.2.2:3000
- Home screen showing breaking stories from the API
- Search, bookmarks, and profile screens
- Local offline storage using Hive
- Firebase initialization scaffold for future integration

## Run locally
1. Install Flutter SDK.
2. Provide real Firebase values when launching the app:

```bash
flutter pub get
flutter run \
  --dart-define=FIREBASE_API_KEY=your-api-key \
  --dart-define=FIREBASE_APP_ID=your-app-id \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=your-sender-id \
  --dart-define=FIREBASE_PROJECT_ID=your-project-id \
  --dart-define=FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com \
  --dart-define=FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app \
  --dart-define=FIREBASE_MEASUREMENT_ID=your-measurement-id
```

3. If you are using Firebase Auth, replace the placeholder values with the values from your Firebase project settings.
