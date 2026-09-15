# Connecting a new site to the Kanvas One app

The same five steps for every site. The customer already has an account
(they signed up on kanvas.one); everything else is you, on the admin page
and in the site's code. Ten minutes.

## 1. The address, on the admin page

Admin → the customer → **Site**: enter their domain (`https://their-site.co.uk`)
and set it to **Live**. That is what makes the site show in the app with
the right name and address.

## 2. The dashboard and the app's features, same page

Under **One app** on the same customer:

- **Dashboard**: `https://their-site.co.uk/admin`. Every site's dashboard
  lives at `/admin`; the field is pre-filled with that once the address
  above is saved. The app frames this page on the Dashboard tab, signed in.
- **Modules**: tick what the site has. **Live chat** puts the Chat tab in
  their app. Payments, bookings and reviews turn on the matching
  notifications.
- **Labels**: what this business calls things (a cafe's "order", a salon's
  "client"), so notifications read naturally.
- **Deep links**: where a record lives in their dashboard, for
  notification taps (`/orders/{id}`).
- **Phone** (Max only): the site's Twilio number and the mobile it rings.

Save. The site id shown here is the customer's account id; the lines
below use it.

## 3. Three lines in the site's code

On **every page**, before `</body>`:

```html
<script src="https://kanvas.one/beacon.js" data-site="<site id>" defer></script>
<script src="https://kanvas.one/chat.js" data-site="<site id>" data-name="Their Business" data-trigger="#chatButton" data-full defer></script>
```

The first is the visitor count for the Analytics tab. The second is live
chat: leave out `data-trigger` for a floating button in the corner, or
give it the id of a button in the site's own header (as kanvas.one does);
`data-full` opens the chat over the whole screen on a phone. Only add the
chat line if the site has the chat module ticked.

If the site **takes payments**, one call on its thank-you or order
confirmation page, after the beacon line, so the payment is counted in the
Analytics tab (amount in pence, ref the order id so a refresh counts once):

```html
<script>k1.payment({ amount: 4500, ref: 'order_123', email: 'sam@example.com' });</script>
```

Tick **Payments** under One app so the money cards show from day one.

On the **dashboard page(s)** (`/admin`), before the dashboard's own scripts:

```html
<script src="https://kanvas.one/kanvas-handoff.js" data-url="https://djhygbmuvacbpbnisuwd.supabase.co" data-key="sb_publishable_7AIUqOnI8DRM2qynFFc2tg_97NuYYUW"></script>
```

That swaps the app's one-time token for a signed-in session on the
dashboard, so the Dashboard tab never shows a login screen. The two
attributes are Kanvas One's own project address and public key, the same
for every site. It only works when the dashboard uses Kanvas One's accounts
(the customer logs into their dashboard with the same email and password as
kanvas.one). A dashboard with its own separate accounts cannot take the
handoff.

## 4. Let the app frame the dashboard, and hide the site chrome

In the site's `vercel.json` (or equivalent), a header on the dashboard
routes so the app may frame them:

```json
{ "key": "Content-Security-Policy", "value": "frame-ancestors 'self' https://kanvas.one" }
```

And in the dashboard's stylesheet, so it reads as a screen of the app
rather than a website in a box (the handoff script sets the class when the
page is framed):

```css
.kanvas-embedded .site-header, .kanvas-embedded .site-footer { display: none; }
```

## 5. Check it works, in this order

1. Open the site in a private window. Within a minute the visit shows on
   the **Analytics** tab in the app (log in as the customer, or pick their
   site from the site picker as admin).
2. Send a message from the site's chat button. It lands in the **Inbox** in
   the app and pushes to the phone. Reply from the app; it appears on the
   site.
3. Open the app as the customer, **Dashboard** tab: their `/admin` page,
   signed in, without its own header and footer.
4. Send a request from the **Support** tab; it lands in your admin inbox.

If step 3 shows their login screen, the handoff line is missing from the
dashboard page or the dashboard is not on Kanvas One's accounts. If it
shows "refused to connect", the frame-ancestors header is missing.
