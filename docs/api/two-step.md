# Two-step sign-in for every account

Any account can turn on two-step sign-in in **Your account → Settings** with an authenticator app
(Google Authenticator, Microsoft Authenticator, 1Password …). After that, every way of signing in
(password, email code, Google, phone, a password reset) stops for a code from the app before a
session starts. Staff keep managing theirs in the console (docs/api/phase9-staff-security.md),
which checks it there instead; the key is the same (`users.mfa_*`).

## Your account (`/api/me/two-step`, signed in)

| | | |
| --- | --- | --- |
| `GET` | | `{enabled, recoveryCodesLeft, managedInConsole}` |
| `POST /setup` | | `{secret, otpauthUri}`: the key for the app (the unfinished one again on a reload). `CONFLICT` when on, or for staff |
| `POST /enable` | `{code}` | turns it on: `{codes}` = 10 recovery codes, shown once. `MFA_CODE_INVALID` |
| `POST /disable` | `{code}` or `{recoveryCode}` | turns it off (a stolen session alone can't) |
| `POST /recovery-codes` | `{code}` | 10 new recovery codes; the old ones stop working |

Turning it on or off emails the account (English and Khmer) so a change nobody asked for is noticed.

## Signing in

Any sign-in endpoint for an account with it on answers **403 `TWO_STEP_REQUIRED`** with
`error.details[0].meta.ticket` instead of a session (no refresh cookie is set). The ticket lives
10 minutes (`auth_ticket`, kind `TWO_STEP`, stored hashed).

`POST /api/auth/two-step` `{ticket, code}` or `{ticket, recoveryCode}` → the session, as the
original sign-in would have answered.

| Error | Meaning |
| --- | --- |
| `MFA_CODE_INVALID` | wrong code; `meta.attemptsLeft` |
| `MFA_LOCKED` | the fifth wrong code used the ticket up: sign in again |
| `INVALID_TOKEN` | unknown, used or expired ticket |

An app code is accepted within ±30 s and never twice (`users.mfa_last_step`); a recovery code
works once. A password sign-in's lockout counter resets only once the code is right too.

## The app

The sign-in page shows **Two-step sign-in** (`?step=two-step`) after any of its sign-ins, with
"Lost your phone? Use a recovery code". Your account → Settings has the set-up (QR code and the
key to type), the recovery codes (copy, download, "I've saved these codes"), new codes and
turning it off.
