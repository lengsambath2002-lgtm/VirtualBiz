# API Phase 9: staff security

Staff (`users.platform_role` = `ADMIN` or `SUPER_ADMIN`) can move money, suspend shops and change
people's accounts, so the console asks more of them than of customers: a strong password,
two-step sign-in (TOTP) on every sign-in, invites instead of self sign-up, and a safe way to
create the very first super-admin.

## The console gate

Every `/api/admin/**` call goes through `AdminAccess`, which runs `StaffGate` after the role
check. In order:

| Missing | Code (403) | The web console shows |
|---|---|---|
| A password of their own (bootstrapped account, or an invite accepted with a weak existing password) | `PASSWORD_CHANGE_REQUIRED` | "Set a new password" |
| Two-step sign-in set up (while `vbiz.staff.mfa-required`) | `MFA_SETUP_REQUIRED` | QR code + key, then 10 recovery codes |
| This sign-in passed the two-step check within `vbiz.staff.mfa-ttl` (12 h): everyone while `mfa-required`, otherwise staff who turned two-step on | `MFA_REQUIRED` | "Two-step sign-in" code (or a recovery code) |

Signing in itself is unchanged for every method (password, email code, phone, Google, reset):
the check is a step-up on the sign-in, kept per refresh-token **family** (`mfa_session`), so it
survives token rotation and ends with the sign-in. When it runs out the console asks again.

## Two-step sign-in (`/api/staff/security`, signed-in staff)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/staff/security` | | `{staff, mustChangePassword, mfaRequired, enrolled, verified, verifiedUntil, recoveryCodesLeft}` |
| POST `/api/staff/security/mfa/setup` | | `{secret, otpauthUri}`: the unfinished key if set-up was started, else a new one; **409** once on |
| POST `/api/staff/security/mfa/enable` | `{code}` | `{codes}` (10 recovery codes, shown once); passes this sign-in's check |
| POST `/api/staff/security/mfa/verify` | `{code}` or `{recoveryCode}` | status; **422** `MFA_CODE_INVALID` with `meta.attemptsLeft`; the 5th wrong code revokes the session (**429** `MFA_LOCKED`) |
| POST `/api/staff/security/mfa/recovery-codes` | | `{codes}`: new set, the old ones stop working |

- RFC 6238: HMAC-SHA1, 6 digits, 30 s, ±1 step for clock drift. A code's time step can't be used
  twice (`users.mfa_last_step`), so an overheard code is useless.
- The key is stored sealed with AES-256-GCM (`SecretBox`, key `VBIZ_DATA_KEY`): a database dump
  alone does not reveal it. Recovery codes are stored as SHA-256 hashes.
- Every enable, recovery-code use, new codes and reset is in the audit log.

## Staff (`/api/admin/staff`)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/admin/staff` | | `StaffMemberRow[]` (role, suspended, two-step on, must change password, last active, `you`) |
| POST `/api/admin/staff/{id}/mfa/reset` | `{reason}` (how you confirmed it's them) | the list; super-admin only, not yourself. Clears their key and codes and signs them out everywhere |
| GET `/api/admin/staff/invites` | | open invites (`expired` flag) |
| POST `/api/admin/staff/invites` | `{email, name, role}` | **201** invite; super-admin only. Withdraws an earlier open invite for the email; **409** if they're already staff |
| DELETE `/api/admin/staff/invites/{id}` | | open invites; super-admin only |

Role changes and removal use `PUT /api/admin/users/{id}/role` (Phase 7). Nobody changes their
own account, and the last active super-admin can't be demoted or suspended (**409**
`LAST_SUPER_ADMIN`). A role change applies on the person's next console request.

## Invites (public)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/staff-invites/{token}` | | `{email, name, role, invitedBy, expiresAt, accountExists, accountHasPassword}`; **404** `INVITE_NOT_FOUND`, **410** `INVITE_EXPIRED` (expired, used or withdrawn) |
| POST `/api/staff-invites/{token}/accept` | `{name?, password}` | `AuthSession` + refresh cookie |

- The link is `{VBIZ_APP_URL}/en/staff-invite/{token}`, valid `vbiz.staff.invite-ttl` (7 days),
  single use; only the token's SHA-256 is stored. The page is `noindex` with `no-referrer`.
- A **new** person sets a name and a staff password. An **existing** account proves it is theirs
  with its password (login lockout applies); a password weaker than the staff rules must be
  changed before the console opens.
- Email: `StaffMailer` (logging stand-in until a provider is configured). Where
  `vbiz.staff.expose-dev-links` (local, test) the API returns `devLink` and the console shows the
  link to copy.

## Passwords

Staff passwords follow the customer rules plus **12+ characters** (rule key `staffLen`), checked
on change, reset, invite and bootstrap.

## The first super-admin

A new environment has no staff. On start, if there is no active super-admin and
`VBIZ_BOOTSTRAP_ADMIN_EMAIL` / `VBIZ_BOOTSTRAP_ADMIN_PASSWORD` (/ `_NAME`) are set,
`StaffBootstrap` creates that account (or promotes the existing one) as `SUPER_ADMIN` with
`must_change_password`, and audits it as "System". The password must meet the staff rules, or
the app refuses to start. The first sign-in then asks for a new password and two-step set-up.
Once any active super-admin exists the variables do nothing; remove them after first start.
Without them the log warns that there is no super-admin.

## Configuration

| Setting | Env | Default |
|---|---|---|
| `vbiz.security.data-key` | `VBIZ_DATA_KEY` (32 bytes, Base64, required outside local/test) | none |
| `vbiz.staff.mfa-required` | `VBIZ_STAFF_MFA_REQUIRED` | `false`: two-step sign-in is optional (staff turn it on in Settings → Staff); `true` makes it compulsory for every staff member (StaffSecurityIntegrationTest runs with `true`, OptionalStaffMfaTest with the default) |
| `vbiz.staff.mfa-ttl` | | `PT12H` |
| `vbiz.staff.invite-ttl` | | `P7D` |
| `vbiz.staff.app-url` | `VBIZ_APP_URL` | `http://localhost:3000` (local `:3001`) |
| `vbiz.staff.expose-dev-links` | | `false` (local, test `true`) |
| `vbiz.staff.bootstrap.*` | `VBIZ_BOOTSTRAP_ADMIN_EMAIL`, `_NAME`, `_PASSWORD` | empty |

Changing `VBIZ_DATA_KEY` makes every enrolled key unreadable: staff then need a reset.

## Local profile

The demo staff sign in with password `Demo@1234` alone while two-step sign-in is optional (the
default); `LocalStaffMfaSeed` takes them off the demo keys below if an earlier run had set them.
With `VBIZ_STAFF_MFA_REQUIRED=true` the seed gives them these fixed keys instead; add the key to an
authenticator app by hand (time-based, 6 digits):

| Account | Key |
|---|---|
| `admin@virtualbiz.com` (super-admin) | `VBIZADMINLOCALDEMOSECRETKEYZZZZZ` |
| `support@virtualbiz.com` (admin) | `VBIZSUPPORTLOCALDEMOSECRETKEYZZZ` |

The e2e tests compute codes from the same keys (`tests/e2e/_helpers/totp.ts`).

## Database

Flyway `V20261020_140000__staff_security.sql`: `users.must_change_password`, `mfa_secret`,
`mfa_enabled_at`, `mfa_last_step`; tables `mfa_recovery_code`, `mfa_session`, `staff_invite`
(one open invite per email); audit target `STAFF_INVITE`.

Audit actions: `STAFF_INVITED`, `STAFF_INVITE_REVOKED`, `STAFF_JOINED`, `STAFF_BOOTSTRAPPED`,
`STAFF_MFA_RESET`, `MFA_ENABLED`, `MFA_RECOVERY_USED`, `MFA_RECOVERY_REGENERATED`.
