# BYU 590R Flutter App

This is the Flutter mobile application for the BYU 590R monorepo project.

## Setup

1. Make sure you have Flutter installed (SDK >=3.0.0)
2. Install dependencies:
   ```bash
   flutter pub get
   ```

## Configuration

The app is configured to connect to the monorepo backend API. The API URL is set in `lib/core/api_client.dart`:
- Development: `http://127.0.0.1:8000/api/`
- Update for production as needed

## Features

- User registration
- User login with authentication
- User profile display
- Logout functionality

## Running the App

```bash
flutter run
```

## Authentication

The app uses Bearer token authentication. After successful login, the token is stored and used for authenticated API requests.

