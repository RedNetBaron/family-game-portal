# Family Games

A phone-friendly website where the family chats and plays games together.
Built with React + Vite on Firebase (Hosting, Authentication, Firestore).

## What works now
- Join with a family invite link (`https://<site>/#/join/<invite-code>`), picking a name and password.
- Sign in with that name and password on any phone or computer.
- One family group chat, updating live. You can delete your own messages.
- A Games tab listing the games that are coming.

## Live site
https://family-games-portal.web.app

Every push to `main` builds the site and deploys it, with the Firestore rules, through
`.github/workflows/deploy.yml`. The workflow needs one repository secret,
`FIREBASE_SERVICE_ACCOUNT`: the JSON key from Firebase console > Project settings >
Service accounts > Generate new private key.

## Invites
Invite codes are documents in the Firestore `invites` collection. Anyone with
`https://family-games-portal.web.app/#/join/<code>` can join. Delete the document to stop new joins,
or add another document for a new code.

## Local development
```
npm install
npm run emulators        # in one terminal (needs Java)
# .env.local: VITE_USE_EMULATORS=true and VITE_FIREBASE_PROJECT_ID=demo-family-games
npm run dev
```
