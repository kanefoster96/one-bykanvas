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

## Live chat

Sites with the chat module get one more line:

```html
<script src="https://kanvas.one/chat.js" data-site="<site id>" data-name="Rowan &amp; Fig" defer></script>
```

A button in the corner, a panel, and the owner gets it on their phone. The
visitor holds a random token for their thread in localStorage and nothing
else. `api/chat.js` is the visitor's door (start, send, poll, details), rate
limited per thread; `api/app.js` (`chat_*`) is the owner's. A reply always
lands in the thread; it also goes by email (Resend, reply-to the owner) when
the owner ticks "also send by email", or when the visitor has left the site
and left an address. A phone number becomes a Call button. Owners can close
a conversation or block a visitor. The app hears new messages through
Supabase Realtime on the site's `messages` rows, with a slow poll as backup.
Optional attributes: `data-color` for the button, `data-greeting` for the
first line.

## Missed calls answered by text (Max)

A site on Max gets a phone number of its own. Calls to it ring the owner's
mobile showing the caller's number; if nobody picks up within twenty
seconds, the caller gets a text within the call ("Sorry we missed your
call. This is Rowan & Fig. We'll call you back shortly...") and the owner's
phone gets a notification. Texts back to that number are pushed to the
owner and forwarded to their mobile with the sender's number in front.

Setup, once: in Vercel set `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`
(Twilio console → Account info). Never paste them into chat or the repo.

Per site: buy a number in Twilio (a local landline number looks right for a
business). On the number's configuration page set:

- Voice → A call comes in → Webhook → `https://kanvas.one/api/twilio/voice`, POST
- Messaging → A message comes in → Webhook → `https://kanvas.one/api/twilio/sms`, POST

Then on the customer's admin page under **One app**, enter the site number
and the mobile it rings through to, and optionally the wording of the text.
The text-back only fires for customers on Max; the forwarding works either
way. Every webhook is checked against Twilio's signature first.

### Texts, WhatsApp and calling back

A text to the site's number becomes a thread in the Chat tab, keyed by the
sender's number, marked **Text**. A missed call opens that same thread with
a "Missed call" note, so the notification lands the owner on a screen with
**Call**, **Call as business** and a reply box. Replies on a Text thread go
out as texts from the site's number. If the owner has no app installed
yet, inbound texts are forwarded to their mobile instead.

**Call as business** asks Twilio to ring the owner's mobile first and, when
they answer, dials the customer showing the site's number (`api/app.js`
`call_back` → `api/twilio/bridge.js`). Both legs are charged.

**WhatsApp**: in Twilio go to Messaging → Senders → WhatsApp senders and
register the site's number as a WhatsApp sender (Meta verifies the
business; a number on the API cannot also be used in the WhatsApp app on a
phone). Point its webhook at the same `https://kanvas.one/api/twilio/sms`.
Messages arrive as **WhatsApp** threads with the sender's WhatsApp name, and
replies go back on WhatsApp. Meta allows free-form replies for 24 hours
after the customer's last message; after that Twilio refuses and the app
says to send a text instead.

Number types: UK 01/02 numbers in Twilio are voice only. UK 07 numbers do
voice and texts, so use an 07 number as the site's number, or pair a
landline number for calls with an 07 number for texts.

## Enquiries answered straight away

A contact form on a site posts to `api/enquiry.js`:

```js
fetch('https://kanvas.one/api/enquiry', { method: 'POST', body: JSON.stringify({ site: '<site id>', name, email, phone, message, page: location.pathname }) });
```

The enquiry is stored, pushed to the owner's phone as "New customer", emailed
to the owner with reply-to set to the sender, and the sender gets "Thanks,
<business> will be in touch shortly" by email at once. Include a hidden
`website` field in the form and leave it empty: bots fill it and are dropped.

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
