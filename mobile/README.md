# Kanvas One, the phone app

An Expo (React Native) app. From version 1.1 every screen a business uses
is native: Build and requests (Kane), Analytics, Chat and contacts,
Messages (Starter), Support and the chat with Kane, Activity and Account.
Lists push full-screen conversations that swipe back from the left edge,
every tap has a little give and a tap of vibration, and changes animate.
The one web page left is the **Dashboard** tab, because it is the
customer's own site's dashboard (for Kane, the admin page): it opens
signed in through a one-time handoff link. No Mac is needed: EAS builds
the iOS app in the cloud and EAS Submit uploads it to TestFlight.

Version 1.0 (the WebView shell around `kanvas.one/app`) keeps working for
anyone who has not updated; kanvas.one/app is unchanged and is still what
a browser shows.

- App name **Kanvas One**, bundle id `one.kanvas.app` (iOS and Android).
- Icon and splash: the "one." wordmark, black on white (`assets/`).
- `App.js`: login, loading the account, push notifications and where a
  tapped one opens. `src/navigation.js`: the tabs for each plan and the
  screens pushed over them. `src/screens/`: the screens.
  `src/components/`: buttons, the segmented pills, bubbles and the reply
  box with photos (`chat.js`), the press feel (`Press.js`).
- The screens call the same API as the web app (`/api/app`, `/api/admin`,
  `/api/requests`) with the person's Supabase login, kept on the phone.
- The build checklists and the feature catalogue are copied from the
  website's `build-steps.js` and `request-catalogue.js` by
  `npm run sync` (into `src/lib/shared.generated.js`). Run it after
  changing either file.

## Trying it in a browser

`npm run web` serves the app at localhost:8081 (react-native-web). Good
enough to check layouts and logic; haptics, push, the camera and the
Dashboard's web view only work on a phone.

## How the Dashboard talks to the phone

Dashboards include `kanvas-handoff.js`. In the 1.1 app it sees
`window.ONE_NATIVE_EMBED` and talks to the app through
`window.ReactNativeWebView` (scan a QR code, add to the calendar, share,
vibrate); answers come back through `window.KanvasAppResult`. In the 1.0
app it was framed inside kanvas.one/app and talked to the parent window;
both still work.

## What the phone adds (1.0, build 7 onwards)

Announced to the page before it loads as `window.ONE_NATIVE_FEATURES`; the
web app (and any dashboard framed in it, through `KanvasApp` in
`kanvas-handoff.js`) only offers what the installed build lists, so an older
install never shows a button it cannot honour.

| Feature | How the page asks | Notes |
|---|---|---|
| Icon badge | `{type:'badge', count}` | The server also sends the count with every push (`_notify.js` `badgeFor`). |
| Vibration | `{type:'haptic', style}` | light, medium, success, warning, error. |
| Share sheet | `{type:'share', message, url}` | "Share your website" in Account, and on Starter's Home card. |
| Rating prompt | `{type:'review'}` | Asked after a reply goes out, once they have used the app on 5 days, at most every 4 months. The phone decides if it shows. |
| QR scanner | `{type:'scan', id}` -> `onScan({id, data})` | Full-screen, orange frame. For check-in on club dashboards: `KanvasApp.scan()`. |
| Add to calendar | `{type:'calendar', id, title, start, end, location, notes}` -> `onCalendar({id, saved})` | The phone's own "add event" sheet. `KanvasApp.addToCalendar()`. |
| Notification buttons | server sends `categoryId` | enquiry: Call, Email (straight to the phone app); chat: Reply (typed on the notification, sent as live chat); missed_call: Call back. |
| Links open the app | `kanvas.one/app...` | Needs `APPLE_TEAM_ID` and `ANDROID_CERT_SHA256` in Vercel; `api/app-links.js` serves the two verification files from them. Until set, links open in the browser as before. |
| Wrapper updates | `expo-updates` | See below. |

### Updating the wrapper without a store build

Screens never need this: they are the web app, live the moment kanvas.one
deploys. This is for `App.js` itself (the bridge, the scanner screen):

```bash
cd mobile
eas update --channel production --message "What changed"
```

Phones fetch it quietly and use it from the next launch. It only reaches
builds with the same app version (`runtimeVersion` follows `version` in
app.json): anything that adds a native module, a permission or a plugin
still needs a new store build, and a `version` bump with it.

### Tap to Pay on iPhone: not in this build

It needs Apple's Tap to Pay entitlement first (requested from Apple by the
account holder; a build that asks for it before Apple grants it fails to
sign) and Stripe Connect behind it (Stripe Terminal takes the payment on the
business's own connected account). Once both are in place it is one more
module (`@stripe/stripe-terminal-react-native`) and one more build.

## First time: from nothing to TestFlight

You need: an Apple Developer account (paid), an Expo account, and this repo
on `main` deployed to kanvas.one (the app loads `/app/` from there, and the
bridge code in `app/app.js` has to be live).

1. Install the EAS CLI and log in to Expo.

   ```bash
   npm install --global eas-cli
   eas login
   ```

2. Create the Expo project for this folder. This writes the project id into
   `app.json` (`extra.eas.projectId`); commit that change.

   ```bash
   cd mobile
   npm install
   eas init
   git add app.json && git commit -m "Link the app to its EAS project"
   ```

3. Build for the App Store. The first run signs in to Apple and sets
   everything up on your behalf: it registers the bundle id, makes the
   distribution certificate and provisioning profile, and asks
   **"Set up Push Notifications for your project?"**: answer **yes**, and yes
   again to generating a new Apple Push Notifications key. The build runs on
   Expo's servers and takes 10 to 20 minutes.

   ```bash
   eas build --platform ios --profile production
   ```

4. Upload it to App Store Connect. If the app does not exist there yet, EAS
   offers to create it; say yes, with the name **Kanvas One**. Once
   uploaded, Apple processes it for 10 to 15 minutes and it appears under
   the app's **TestFlight** tab.

   ```bash
   eas submit --platform ios --latest
   ```

5. In App Store Connect → your app → TestFlight → **Internal Testing**,
   create a group, add yourself (and anyone else on your team) by Apple ID.
   Install the **TestFlight** app on your iPhone, accept the invite, and
   install Kanvas One. Log in with your Kanvas One email and password, and
   allow notifications when asked.

Every build after that is steps 3 and 4 again (`npm run build:ios` then
`npm run submit:ios`). The build number increments on its own
(`autoIncrement` in `eas.json`).

To build and submit from a Claude chat with the Expo connector, link the
GitHub repo to the Expo project (expo.dev → the project → GitHub, base
directory `mobile`); after that `build_run` with profile `production` and
`autoSubmit` does both steps.

## Android

`eas build --platform android --profile production` makes the Play Store
bundle. Push on Android goes through Expo as well, but Expo needs an FCM
key for it: Firebase → project settings → Cloud Messaging → generate a
service account key, then `eas credentials --platform android` → Push
Notifications → upload it. Google Play needs an app record and a first
manual upload before `eas submit --platform android` can take over.

## Testing on your own phone before TestFlight

`eas build --platform ios --profile preview` makes an ad-hoc build you can
install straight from the build page's QR code. It asks to register your
iPhone's UDID the first time (`eas device:create` sends you a link to open
on the phone).

## Store review notes

- Give App Review a demo login. Both stores reject login-only apps without
  one. There is a seeded one: **demo@kanvas.one**, a customer-style
  account for a demo salon ("Rowan & Fig") with six weeks of visits, three
  chats, two requests and a handful of notifications. The password is not
  in this repo; it goes in the App Review notes only. Re-seed it any time
  by re-running the block in the session notes (it deletes and rewrites
  the demo's own rows, nothing else).
- The Account sheet has **Delete my account**, which cancels any plan and
  removes the login and everything under it (Apple 5.1.1(v), Google Play's
  data deletion policy). The admin account is refused.
- The app has no signup, no prices and nothing to buy, on purpose: the
  subscription is for the website, bought on the website, and the app is
  its companion. Say so in the review notes.
- Notifications are asked for after login, not at launch.
