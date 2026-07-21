import 'package:flutter/material.dart';

class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Stay connected to local stories', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              const Text('Follow breaking news, bookmark stories, and join the conversation.'),
              const SizedBox(height: 24),
              FilledButton(onPressed: () {}, child: const Text('Get started')),
            ],
          ),
        ),
      ),
    );
  }
}
