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

Anyone can turn them off in **My settings → Email me about orders, bookings and my shops**
(`users.pref_emails`); the inbox keeps everything.

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

The demo accounts' addresses (`nita@virtualbiz.com` …) don't exist: their emails bounce back to the
Gmail inbox. To receive them, put a real address on the account you test with.

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
