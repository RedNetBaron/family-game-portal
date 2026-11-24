# Family Games

A phone-friendly website where the family chats and plays games together.
Built with React + Vite on Firebase (Hosting, Authentication, Firestore).

## What works now
- Join with a family invite link (`https://<site>/#/join/<invite-code>`), picking a name and password.
- Sign in with that name and password on any phone or computer.
- One family group chat, updating live. You can delete your own messages.
- A Games tab listing the games that are coming.

## One-time Firebase setup
1. In the Firebase console, open the project and add a **Web app**. Copy its config values into `.env.local` (see `.env.example`).
2. **Authentication → Sign-in method:** turn on **Email/Password**. (Family members never see an email; names are turned into private sign-in addresses.)
3. **Firestore Database:** create a database (production mode).
4. **Firestore → Data:** add a collection `invites` with one document whose ID is your invite code (for example `thanksgiving-2026`). Anyone with `/#/join/<that code>` can join. Delete the document to stop new joins.
5. Deploy: `npx firebase login`, `npx firebase use <project-id>`, then `npm run deploy`.

## Local development
```
npm install
npm run emulators        # in one terminal (needs Java)
# .env.local: VITE_USE_EMULATORS=true and VITE_FIREBASE_PROJECT_ID=demo-family-games
npm run dev
```
