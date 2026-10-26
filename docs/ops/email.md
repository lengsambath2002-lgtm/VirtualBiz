# Email

The API sends three kinds of email, each in English then Khmer, in one shared layout
(`com.kosign.vbiz.mail.Email`: table layout and inline styles for mail apps, plus a plain-text part):

| Email | Sent by | Buttons |
| --- | --- | --- |
| Sign-up, sign-in and password-reset codes | `MailOtpSender` (phone codes still go to the SMS stand-in) | none: a large code, valid 10 minutes, once |
| Shop team invite | `SmtpTeamMailer` | **Accept invite** and **Decline** |
| Console staff invite | `SmtpStaffMailer` | **Accept invite** |
| **Every inbox notification** | `NotificationEmails` | one button to the order, booking, calendar or settings page |

### Notification emails

Every notification that reaches an inbox also goes out by email (`NotificationCreated` →
`NotificationEmails`, in the background once the change is saved; words in
`NotificationEmailContent`):

| To | When |
| --- | --- |
| Customer | order placed (new), accepted, ready to pick up, on the way, delivered / picked up, returned, cancelled; booking requested, confirmed, declined, moved, reminder, cancelled |
| Shop owner and managers (not staff) | new order, order cancelled, booking request, booking cancelled, new review, ID check passed / failed, shop paused / back, payout sent, category suggestion approved / declined |

### Choices

In **Your account → Settings → Notifications**, each person chooses per topic whether it comes by
email and by push (`users.notify_off`, the topics turned off per channel; `PUT /api/me/prefs`
`topics`). The inbox in the app always gets everything.

| Topic | Notifications |
| --- | --- |
| `ORDERS` | a customer's orders |
| `BOOKINGS` | a customer's bookings |
| `SHOP_ACTIVITY` | a shop's new orders and bookings, and their cancellations |
| `STOCK` | low stock |
| `REVIEWS` | new reviews |
| `ACCOUNT` | from VirtualBiz: ID check, suspension, payouts, category suggestions |

Shop topics show to people with a shop. Sign-in codes, invites and security alerts are not
notifications and always go.

## Settings

| Setting | Default | |
| --- | --- | --- |
| `VBIZ_MAIL_ENABLED` | `false` (`true` in the `local` profile) | off: emails are only logged (`Logging*Mailer`, `LoggingOtpSender`) |
| `VBIZ_MAIL_FROM` | `VirtualBiz <no-reply@virtualbiz.com.kh>` | the From address |
| `SMTP_HOST`, `SMTP_PORT` | `localhost`, `1025` | |
| `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_AUTH`, `SMTP_STARTTLS` | empty, `false`, `false` | a real provider needs auth and STARTTLS |

Emails go out **after** the change that caused them is saved: a rolled-back invite sends nothing, and an
SMTP server that is down never undoes an invite (the failure is logged). The mail health check is on only
when emails are on.

## Sending through Gmail

Gmail sends from your own address (about 500 emails a day on a personal account):

1. Turn on 2-Step Verification (https://myaccount.google.com/security), then create an **App
   Password** (https://myaccount.google.com/apppasswords). Never use the account password.
2. In `backend/.env` (git-ignored), or the host's environment:

   ```sh
   VBIZ_MAIL_ENABLED=true
   VBIZ_MAIL_FROM="VirtualBiz <you@gmail.com>"   # must be the Gmail address
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_AUTH=true
   SMTP_STARTTLS=true
   SMTP_USERNAME=you@gmail.com
   SMTP_PASSWORD=<the 16-letter app password>
   ```

Outside production, limit who gets real email with `VBIZ_MAIL_ONLY_TO` (comma-separated
addresses or domains, e.g. `gmail.com`): the rest are logged as skipped. Without it, the demo
accounts' made-up addresses (`nita@virtualbiz.com` …) and the tests' `@example.com` ones would bounce
back into the Gmail inbox and can get the account flagged. Put a real address on the account you test
with to receive its emails.

## Locally: Mailpit

Mailpit catches every email; nothing reaches a real inbox.

- On a Mac: `brew install mailpit && brew services start mailpit`, then open http://localhost:8025.
- With Docker: `infra/docker/compose.yml` runs it; the same address.

The `local` profile sends to `localhost:1025`. Open an invite there and press **Accept invite** or
**Decline**: they open the app's invite page (`/join/{token}`, `?decline=1`).

## Why the buttons don't act on their own

Mail security scanners open every link in a message. A link that joined or declined by itself could do
so before the person reads the email, so both buttons open the invite page, which asks for one more
click (docs/api/phase10-shop-team.md).

## Never email (`vbiz.mail.never-to`)

Addresses or domains that never get an email, whatever else is set. The public demo lists its
made-up accounts (`application-demo.yml`): they belong to nobody, or to a stranger who happens to
own that Gmail address, and bounces would land in the sender's inbox. People who sign up on the
demo get their emails as usual.
