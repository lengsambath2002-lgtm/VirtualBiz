# Email

The API sends three kinds of email, each in English then Khmer, in one shared layout
(`com.kosign.vbiz.mail.Email`: table layout and inline styles for mail apps, plus a plain-text part):

| Email | Sent by | Buttons |
| --- | --- | --- |
| Sign-up, sign-in and password-reset codes | `MailOtpSender` (phone codes still go to the SMS stand-in) | none: a large code, valid 10 minutes, once |
| Shop team invite | `SmtpTeamMailer` | **Accept invite** and **Decline** |
| Console staff invite | `SmtpStaffMailer` | **Accept invite** |

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
