# Firebase: sign-in and push notifications

VirtualBiz uses the Firebase project **`virtaulbiz`** for:

- **Sign-in with Google** (Google's account chooser in a popup).
- **Sign-in with email + password**: Firebase checks the password.
- **Push notifications** (Firebase Cloud Messaging): every inbox notification also pops up on the
  browsers where people turned push on.

VirtualBiz still keeps its own session (access token + refresh cookie), roles and accounts. Firebase
only proves who signed in: the web app sends the Firebase ID token to `POST /api/auth/firebase`,
which verifies it with the Admin SDK and returns a normal VirtualBiz session.

With nothing configured, everything works as before: VirtualBiz checks passwords itself, Google
uses the dev chooser (or Google Identity Services with `NEXT_PUBLIC_GOOGLE_CLIENT_ID`), and the push
toggle is hidden.

## How each sign-in works

| Way in | Web app | API |
|---|---|---|
| Google | `signInWithPopup(GoogleAuthProvider)` → ID token | `POST /api/auth/firebase`: finds the account by email or makes it; adds the Google photo |
| Email + password | `signInWithEmailAndPassword` → ID token | `POST /api/auth/firebase`; a password account must have a confirmed email (`EMAIL_NOT_VERIFIED`) |
| Account made before Firebase | Firebase says "wrong credentials" → `POST /api/auth/firebase/migrate` → Firebase again | `migrate` checks the password VirtualBiz keeps (same lockout and errors as `/api/auth/login`), then gives the Firebase login the same password, marked confirmed |
| Sign-up | Unchanged: email code from VirtualBiz, then `migrate` in the background | The Firebase login exists straight away |
| Forgot / change password | Unchanged (VirtualBiz's own screens) | The new password is copied to Firebase |
| Firebase unreachable | Falls back to `POST /api/auth/login` | — |

Sign-out ends the Firebase session too and unregisters this browser's push token.

The link between the two accounts is `users.firebase_uid` (unique).

## Push notifications

- My settings → Notifications → **Push notifications on this device**. Turning it on asks the
  browser's permission, gets this browser's FCM token through `public/firebase-messaging-sw.js`,
  and stores it with `POST /api/me/push-tokens` (`DELETE` turns it off). Table: `push_token`.
- `NotificationPush` listens for `NotificationCreated` after the transaction commits, in the
  background, and sends the same wording as the emails (`NotificationEmailContent`) to the same
  people (`NotificationRecipients`: the customer, or a shop's owner and managers). The click opens
  the notification's page.
- Tokens Firebase reports as `UNREGISTERED` are deleted.
- Firebase only opens `https://` links by itself; locally (`http://localhost`) the service worker
  opens them.

## Set up

1. **Firebase console → Authentication → Sign-in method**: enable **Google** and
   **Email/Password**.
2. **Authentication → Settings → Authorized domains**: add `virtualbiz.vercel.app` (and any
   other domain the web app runs on). `localhost` is there already.
3. **Project settings → General → Your apps → Web app** (add one if there is none). Copy the config
   into the web app's environment (`frontend/.env.local` locally, Vercel → Settings → Environment
   Variables for Production and Preview):
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=…
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=virtaulbiz.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=virtaulbiz
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=…
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=…
   NEXT_PUBLIC_FIREBASE_APP_ID=…
   ```
   These values are public by design. Restrict the API key to your domains in Google Cloud →
   Credentials.
4. **Project settings → Cloud Messaging → Web Push certificates → Generate key pair**:
   `NEXT_PUBLIC_FIREBASE_VAPID_KEY=…`
5. **Project settings → Service accounts → Generate new private key**. Save the file as
   `backend/firebase-service-account.json` (git ignores it; never commit or paste it anywhere).
   In `backend/.env`:
   ```
   VBIZ_FIREBASE_ENABLED=true
   VBIZ_FIREBASE_PROJECT_ID=virtaulbiz
   VBIZ_FIREBASE_CREDENTIALS=firebase-service-account.json
   ```
   On Render, add the JSON as a **Secret File** named `firebase-service-account.json` and set
   `VBIZ_FIREBASE_CREDENTIALS=/etc/secrets/firebase-service-account.json`.
6. Restart the API and the web app. The API logs `[FIREBASE] Project virtaulbiz ready`.

## Test locally without the real project

The Firebase Auth emulator stands in for Firebase (Google sign-in shows the emulator's fake
account chooser):

```bash
# 1. Emulator (needs Java), in an empty folder with firebase.json:
#    {"emulators":{"auth":{"port":9099,"host":"127.0.0.1"},"ui":{"enabled":false}}}
npx firebase-tools@15.34.1 emulators:start --only auth --project virtaulbiz

# 2. API
cd backend && VBIZ_FIREBASE_ENABLED=true VBIZ_FIREBASE_PROJECT_ID=virtaulbiz \
  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 ./gradlew bootRun

# 3. Web
cd frontend && NEXT_PUBLIC_FIREBASE_API_KEY=emulator-key NEXT_PUBLIC_FIREBASE_PROJECT_ID=virtaulbiz \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR=http://127.0.0.1:9099 \
  PORT=3001 pnpm dev
```

Push needs the real project (the emulator has no Cloud Messaging). The backend tests
(`FirebaseIntegrationTest`) cover sign-in, migration and push with a stubbed gateway.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Google: "isn't available right now" | Google provider off, or this domain isn't in Authorized domains |
| Google: "blocked the Google window" | The browser blocked the popup |
| API `NOT_CONFIGURED` on `/api/auth/firebase` | `VBIZ_FIREBASE_ENABLED` is false on the API but the web app has the Firebase config |
| API `INVALID_TOKEN` | Web app and API point at different Firebase projects |
| No push toggle in My settings | Missing sender id, app id or VAPID key, or the browser has no push support (iOS needs the site added to the Home Screen) |
| Toggle disabled, "blocked" | Notifications denied for the site in the browser's settings |
