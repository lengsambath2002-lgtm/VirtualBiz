# Public demo

A free, public copy of VirtualBiz that anyone can try: the web app on **Vercel**, the API and its
database on **Render** (`render.yaml`), running the API's `demo` profile.

## What testers get

| | |
| --- | --- |
| Customer marketplace | browse, cart, checkout (KHQR is confirmed with **Simulate payment**) |
| Shop owner | `nita@virtualbiz.com` / `Demo@1234` (Nita Gadget Store: orders, POS, products, team …) |
| Salon owner | `hello@glowbeauty.com.kh` / `Demo@1234` (Glow Beauty: calendar, bookings, sales …) |
| Super-admin console | `admin@virtualbiz.com` / `Demo@1234` (`/admin`) |
| New accounts | sign up normally: the code arrives **by email** (needs `VBIZ_MAIL_*` on the API, docs/ops/email.md) |
| Team invites | sent by email; the link is never shown on screen |
| Phone sign-in | hidden: no SMS provider is connected |

The `demo` profile (`application-demo.yml`) loads the demo data (`db/seed-local`) into an empty
database on first start, turns on the payment simulator, and keeps real secrets and secure
cookies. Being a public URL, it handles codes and invite links like production (docs/ops/security.md). The fake Google chooser and the test endpoints stay off. **Demo data
only: never point it at a real database.** Everyone shares the demo accounts, so anything a tester
changes, others see.

## Set it up (once)

1. **API on Render.** Sign in at https://dashboard.render.com, then **New → Blueprint**, pick this
   GitHub repository and its branch. Render reads `render.yaml`: a Docker web service
   `virtualbiz-api` and a Postgres database `virtualbiz-db`, both free, in Singapore, with the
   database settings and two generated secrets wired in. The first build takes ~10 minutes.
   Note the service address, e.g. `https://virtualbiz-api.onrender.com`; `…/api/health` says `UP`.
2. **Web app on Vercel.** From `frontend/`: `vercel link`, then set the API address for every
   environment and deploy:

   ```sh
   vercel env add API_URL production   # https://virtualbiz-api.onrender.com
   vercel deploy --prod
   ```

   `/api/*` on the Vercel address is forwarded to `API_URL`, so sign-in cookies stay same-origin.
3. **Tell the API where the web app is.** In Render, set `VBIZ_APP_URL` on `virtualbiz-api` to the
   Vercel address (invite links point there), and redeploy.

## Limits of the free plans

- The Render service **sleeps after 15 idle minutes**; the next visit waits ~1 minute while it
  starts (the app shows its loading state, then works).
- Render's free database **expires after 30 days**; create a new one (the demo data loads again).
- Uploaded photos live on the service's disk and **disappear on restart** (no persistent disk on
  the free plan); the demo's own photos are unaffected.
- Live updates (new orders, bookings) go over a long-lived connection that Vercel may close after
  a while; pages also refresh on their own.
