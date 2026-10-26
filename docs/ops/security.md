# Codes, links and personal data: what may be shown

One-time codes (sign-up, email sign-in, password reset, phone) and invite links let whoever holds
them into an account or a shop. In the real world they reach only their owner, through the owner's
inbox or phone, and nowhere else.

## Where they go

| | Developer machine and tests (`local`, `dev`, `test`) | Anywhere else (`demo`, production) |
|---|---|---|
| Sign-up / sign-in / reset code | emailed (Mailpit, or a real inbox with Gmail set up), **and** in the API reply (`devCode`) for the automated tests. Never on screen | **emailed only**. Never in a reply, on screen or in a log |
| Phone code | in the reply (no SMS provider), for the tests | phone sign-in is **off**: `GET /api/auth/methods` says `phone: false`, the pages hide "Continue with phone number", and `POST /api/auth/otp` for PHONE answers `NOT_CONFIGURED` instead of pretending a text was sent |
| Team / console invite link | emailed, and shown to the inviter (`devLink`) | **emailed only** |
| Fake Google chooser | on | off |

The switches are `vbiz.otp.expose-dev-code`, `vbiz.staff.expose-dev-links` (team invites follow
it), and `vbiz.auth.google-dev-enabled`. All are off by default. **The API refuses to start** if any
of them is on outside `local`, `dev` or `test` (`config/DevExposureGuard`), so a copied config can't
open every account on a public server.

The app never shows a code, in any environment: it says where the code was sent ("Open Gmail",
"Open Outlook") and the person types it, as they would with a real email. The end-to-end tests
read `devCode` from the API reply instead (`watchCodes` in `tests/e2e/_helpers/app.ts`).

## Two-step sign-in

Any account can add a code from an authenticator app to every sign-in (docs/api/two-step.md);
staff have it in the console, and `vbiz.staff.mfa-required` can make it compulsory for them.

## Stored and logged

- Codes are stored only as SHA-256 hashes, expire after 10 minutes, work once, and die after 5
  wrong tries. Asking again is rate-limited.
- Log lines never carry a code or a full address: `LogMask.text` hides any run of 4+ digits
  (an email subject like "482913 is your VirtualBiz code" becomes "•••• is your VirtualBiz code"),
  and `LogMask.contact` shortens addresses (`d***@gmail.com`, `***678`).
- Invite tokens and refresh tokens are stored hashed; only the person's email holds the link.

## Turning on SMS later

Connect a provider (an `OtpSender` for `PHONE`, e.g. Firebase Phone Auth on the Blaze plan, or an
SMS gateway). Then make `AuthService.phoneAvailable()` true when it is configured, and phone
sign-in appears again.
