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

## The numbers

The Analytics tab is the same for every site: visitors, who is on the site
now, page views, visitors a day, top pages, the routes visitors take
through the site, where they came from, phone or desktop, and country. All
of it comes from the beacon line above. Two more cards appear when the
site has them:

- **Money in**: taken, number of payments, paying customers, average
  payment, refunds, against the period before.
- **Live chat**: conversations, and how many of the people who messaged
  went on to pay.
- **From a visit to a payment**: visited, messaged, paid, as three bars.

A site that does not have payments or chat sees a short "not connected"
card in their place, nothing more.

### Counting a payment

Any site that takes payments, through Stripe, PayPal, Square or anything
else, reports each one with a single call on its thank-you or order
confirmation page:

```html
<script>k1.payment({ amount: 4500, ref: 'order_123', email: 'sam@example.com', name: 'Sam', description: 'Cut and colour' });</script>
```

`amount` is in pence. `ref` is the order or payment id: the same ref twice
is one payment, so a refreshed page does not count twice. `email` is what
ties a payment to a chat when the visit is not known; `name` and
`description` are optional. The call goes to `api/beacon.js` alongside the
page views and is stored in `payments`, one row per payment, owner-readable
only. Tick **Payments** under One app on the admin page so the cards show
before the first payment lands.

Visits, chats and payments are tied together by the beacon's session id:
random per browser tab, gone when the tab closes, never a cookie. chat.js
sends it when a conversation starts and the thank-you page sends it with
the payment, so the app can say "9 of the 38 who messaged went on to pay".

## Live chat

Sites with the chat module get one more line:

```html
<script src="https://kanvas.one/chat.js" data-site="<site id>" data-name="Rowan &amp; Fig" defer></script>
```

A button in the corner, a panel, and the owner gets it on their phone. The
visitor holds a random token for their thread in localStorage and nothing
else. `api/chat.js` is the visitor's door (start, send, poll, details), rate
limited per thread; `api/app.js` (`chat_*`) is the owner's. A phone number
becomes a Call button. Owners can close a conversation or block a visitor.
The app hears new messages through Supabase Realtime on the site's
`messages` rows, with a slow poll as backup. Optional attributes:
`data-color` for the button, `data-greeting` for the first line,
`data-trigger="#id"` to use the site's own button, `data-full` for a
full-screen chat on phones.

### Live chat or email

Every reply in the app is sent as **Live chat** or **Email**, the owner's
choice, with the right one picked first:

- Visitor on the site now: live chat, straight into the widget.
- Visitor gone, email left: email, with the reply, the last few lines of
  the thread, a **Continue the chat** button back to the page they were on
  (`?k1chat=open` opens the widget), and a reply address. A live-chat reply
  to them is emailed as well, whichever button was pressed, so nothing is
  lost.
- Visitor gone, nothing left: chat only; they see it when they return.
- Text and WhatsApp threads take no typed replies. Texts are for
  automations only (the missed-call text-back), to keep costs down; the
  owner calls back, or emails if an address was left.

**Email replies back into the inbox.** Once, in Resend: add a domain for
receiving (say `reply.kanvas.one`, one MX record), add a webhook for
`email.received` pointing at `https://kanvas.one/api/email-inbound`, and set
`CHAT_REPLY_DOMAIN` and `RESEND_WEBHOOK_SECRET` in Vercel. Every chat email
then carries `reply+<conversation id>@reply.kanvas.one` as its reply address;
a visitor's reply is checked against the address they gave, the quoted
history is cut off, and what they wrote lands in the thread and on the
owner's phone. Until that is set up, replies go to the business's own inbox.

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

Inside the app the dashboard should look like a screen of the app, not a
website in a box: `kanvas-handoff.js` adds `kanvas-embedded` to `<html>`
whenever the page is framed, so the dashboard's stylesheet can hide its own
header and footer (`.kanvas-embedded .site-header { display: none }`).
kanvas.one's own admin page does the same.

How it works: the app asks `api/app.js` (`dashboard`) for a handoff URL. The
server checks the site is theirs, mints a single-use magic-link token for the
signed-in user with Supabase's admin `generateLink` (no email is sent), and
returns the dashboard address with the token in the URL fragment. The frame
loads it; `kanvas-handoff.js` swaps the token for a session on the dashboard's
own origin with `verifyOtp`, strips the fragment and reloads. The app's own
session never leaves the app, the token never reaches a server log, and it
cannot be used twice. Every deep link is the same handoff at a different path.

## Server setup, once

1. Run migrations `0031` to `0038` (done on the live project on 15 Sep 2026).
2. Push needs nothing in Vercel. The native app registers an Expo push
   token and `api/_push.js` sends through Expo's push service; the Apple
   push key is held by the EAS project (see `mobile/README.md`). Optional:
   `EXPO_ACCESS_TOKEN`, only if enhanced push security is turned on for the
   Expo account. `FCM_SERVICE_ACCOUNT` is only read for raw FCM tokens from
   the old Capacitor bundle.

## The native app

`mobile/` is the Expo shell: a WebView on `/app/` plus push. This page
detects it through `window.ReactNativeWebView` and switches to shell mode
(the bridge is at the top of `app.js` and in `setupPush`). Build and
TestFlight steps are in `mobile/README.md`. Name **Kanvas One**, bundle id
`one.kanvas.app`.

## Store submission notes

- Provide a demo login in App Review notes (a real customer-style account on
  a demo site with a few visits, requests and notifications in it). Both
  stores reject login-only apps without one.
- The app has no signup, no prices, no plan names and no links to buy
  anything, on purpose. Keep it that way: the subscription is for the
  website, bought on the website, and the app is its companion.
- Notifications are asked for after login, not at launch.
