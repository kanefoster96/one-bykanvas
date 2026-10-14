# Kanvas One app: App Store & Google Play submission

Read before every submission. Most rejections are a missing note or an empty
demo account, not a missing feature. Lessons carried over from the Kanvas
Academy app's own rejections are marked **(Academy)**.

## What the app is, for the reviewer

A free companion to a paid web service (guideline 3.1.3(f)). Businesses sign
up and pay on kanvas.one; the app is where they run what we built for them:
website visits, live chat with visitors, payments, contacts and requests to us.
There is no sign-up, price, plan or "upgrade" anywhere in the app, and there
must never be one. Inside the app a Starter customer is not shown Business
features (requests.js, `starterInApp`).

## Already done in the app

- **Logins on a phone with a wrong clock (Academy).** App Review's iPad had a
  clock set ahead; a fresh login looked expired and the app stalled.
  `supabase-client.js` counts a session's expiry on the device's own clock.
- **Links never leave the app (Academy, build 27).** Outside links open in the
  in-app browser sheet (`WebBrowser.openBrowserAsync`); tel/mail/sms go to the
  phone. The app's window stays on /app; any other kanvas.one page opens in the
  sheet (mobile/App.js `shouldStart`; ships with the next build or EAS update).
- **Account deletion (5.1.1(v)).** Account → Delete my account, for every
  customer. Cancels the Stripe plan, removes files and the login; every table
  cascades. Staff accounts are refused by design. Also on the privacy page:
  `kanvas.one/privacy#delete`.
- **Privacy policy in the app (5.1.1(i)).** Login screen and Account, with
  Terms and Contact support.
- **User content (1.2).** A chat visitor can be blocked; support contact is in
  Account.
- **No tracking.** No pixel or analytics in the app. App Tracking: not tracking.
- **No Sign in with Apple needed (4.8).** Email and password only, our own.
- **Offline.** The shell shows "Can't reach kanvas.one" with a retry.
- **Native features (4.2, "more than a website").** Push notifications (with
  Reply from the notification), app icon badge, share sheet, add to calendar,
  QR scanning with the camera, photos from the camera or library, haptics,
  in-app review prompt.
- `usesNonExemptEncryption: false`, iPhone only (`supportsTablet: false`;
  reviewers may still run it on an iPad in iPhone mode, so test that).

## Every submission

1. **Demo account works and is full.** `appreview@kanvas.one` (password with
   Kane, never in the repo): "Little Movers Kids Club", a Business customer
   with 60 days of visits, chats (one waiting for a reply), payments and a
   refund, enquiries, contacts and two Support threads. Its dates are relative
   to when it was built, so rebuild it shortly before each submission, and
   whenever a reviewer has deleted it: run `scripts/app-review-demo.sql` in the
   Supabase SQL editor with the password filled in. Sign in on a phone first.
2. **App Store Connect:** privacy policy URL `https://kanvas.one/privacy`,
   support URL `https://kanvas.one/contact`, App Privacy answers below.
3. **Screenshots** show only what the demo account can reach.
4. **Review notes:** paste the block below, with the demo login.

### Review notes

> Kanvas One is a free companion app for small businesses whose website we
> build and run. Businesses sign up and pay on our website (kanvas.one); there
> are no purchases, prices or sign-up in the app (3.1.3(f)).
>
> Demo login (a Business plan customer with sample data):
> Email: appreview@kanvas.one  Password: (from Kane)
>
> Things to try:
> - Analytics: visits to the business's website over the last 30 days.
> - Chat: conversations with website visitors. Reply to the waiting one; a
>   push notification arrives for new messages and can be answered from the
>   notification itself.
> - Contacts and payments taken through the website.
> - Support: requests and messages to our team, with photos from the camera
>   or library.
> - Share the website (share sheet), add a booking to the calendar.
> - Account: privacy policy, terms, support, and Delete my account.
>
> The app needs an internet connection; it shows a retry screen without one.

### App Privacy answers

Data linked to the user, used only for app functionality: name, email address,
phone number (if given), photos (attached to requests or messages), customer
support messages, other user content (chat replies), purchase history (their
plan). Device ID: the push token, for notifications only. No tracking, no
third-party advertising, no data sold.
