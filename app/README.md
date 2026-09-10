# The One app

A notification layer, live chat and analytics for the sites we build. The
web app lives at `/app/` (this folder) and the same files, unchanged, run
inside a native wrapper (Capacitor) for the App Store and Google Play.

Five tabs: Dashboard (the customer's own site dashboard, opened inside the
app), Analytics (from `beacon.js` on their site), Payments (money in, once
Stripe Connect lands), Chat (only for sites with live chat) and Support (the
Requests feature, from the same `requests.js` the website uses).

## What every new site gets

One line before `</body>` on every page, with the site's id (the customer's
profile id, shown on their admin detail page):

```html
<script src="https://kanvas.one/beacon.js" data-site="<site id>" defer></script>
```

Then on the admin page, under the customer, **One app**: the dashboard
address, which modules the site has, what they call things (job / order /
booking / client) and where records live in the dashboard.

## The dashboard inside the app

Every dashboard we build gets two things:

1. This line before the dashboard's own scripts:
   ```html
   <script src="https://kanvas.one/kanvas-handoff.js" data-url="https://<ref>.supabase.co" data-key="<publishable key>"></script>
   ```
2. A header that lets the app frame it, in the dashboard's `vercel.json`:
   ```json
   { "key": "Content-Security-Policy", "value": "frame-ancestors 'self' https://kanvas.one capacitor://localhost https://localhost" }
   ```

How it works: the app asks `api/app.js` (`dashboard`) for a handoff URL. The
server checks the site is theirs, mints a single-use magic-link token for the
signed-in user with Supabase's admin `generateLink` (no email is sent), and
returns the dashboard address with the token in the URL fragment. The frame
loads it; `kanvas-handoff.js` swaps the token for a session on the dashboard's
own origin with `verifyOtp`, strips the fragment and reloads. The app's own
session never leaves the app, the token never reaches a server log, and it
cannot be used twice. Every deep link is the same handoff at a different path.

## Server setup, once

1. Run `supabase/migrations/0035_one_app.sql`.
2. Push: create a Firebase project, enable Cloud Messaging, upload the Apple
   APNs key (Apple Developer → Keys → APNs) so iOS goes through Firebase too.
   Create a service account (Project settings → Service accounts → Generate
   new private key), base64 the JSON file and set it in Vercel as
   `FCM_SERVICE_ACCOUNT`. Never paste it into chat or a file in this repo.
   Without it, everything works and nothing is pushed.

## Native build (on a Mac with Xcode and Android Studio)

```bash
npm install
npm run app:build            # bundles app/ + shared files into app-dist/
npx cap add ios
npx cap add android
npm run app:ios              # sync + open Xcode
npm run app:android          # sync + open Android Studio
```

Commit the generated `ios/` and `android/` folders. After that, every
change to `app/` is `npm run app:sync`, then build from Xcode / Android
Studio. The wrapper enables `CapacitorHttp`, so requests to kanvas.one go
through native networking and need no CORS changes on the API.

- iOS: add the Push Notifications capability and Background Modes → Remote
  notifications in Xcode; drop `GoogleService-Info.plist` from Firebase into
  the app target.
- Android: drop `google-services.json` from Firebase into `android/app/`.
- App id `one.kanvas.app`, name **One**. Icons and splash from
  `assets/favicon.svg` via `@capacitor/assets` when ready.

## Store submission notes

- Provide a demo login in App Review notes (a real customer-style account on
  a demo site with a few visits, requests and notifications in it). Both
  stores reject login-only apps without one.
- The app has no signup, no prices, no plan names and no links to buy
  anything, on purpose. Keep it that way: the subscription is for the
  website, bought on the website, and the app is its companion.
- Notifications are asked for after login, not at launch.
