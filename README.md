# Personal Notes

An Expo React Native notes app using Firebase Authentication and Cloud Firestore.

## Setup

1. Enable **Email/Password** in Firebase Console under Authentication.
2. Create a Firestore database and publish [`firestore.rules`](./firestore.rules) and [`firestore.indexes.json`](./firestore.indexes.json).
3. Install dependencies with `npm install`.
4. Start Expo with `npm start`.

The Firebase web configuration is in [`firebaseConfig.ts`](./firebaseConfig.ts). Firebase Auth manages the current session for the running app.

## Data model

Each document in the `notes` collection contains `title`, `content`, `favorite`, `userId`, `createdAt`, and `updatedAt`. Firestore rules require every read and write to belong to the authenticated user's `uid`.
