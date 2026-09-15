# Kanvas One, the phone app

An Expo (React Native) shell around the web app at `https://kanvas.one/app/`.
The shell is a full-screen WebView plus push notifications; every screen the
customer or the admin sees is the web app itself, served from kanvas.one, so
a fix on the site is a fix in the app the next time it opens. No Mac is
needed: EAS builds the iOS app in the cloud and EAS Submit uploads it to
TestFlight.

- App name **Kanvas One**, bundle id `one.kanvas.app` (iOS and Android).
- Icon and splash: the "one." wordmark, black on white (`assets/`).
- `App.js` is the whole app. `app.json` is the app config, `eas.json` the
  build profiles.

## How it talks to the web app

`app/app.js` on the site detects `window.ReactNativeWebView` and switches
into shell mode. The web app posts `{type:'ready'}` when it has booted,
`{type:'push:register'}` when it wants a push token, and `{type:'open', url}`
for links that should leave the app. The shell calls back into the page
through `window.ONE_NATIVE`: `onPushToken(token)`, `onPushDenied(reason)`,
`openLink(data)` when a notification is tapped, and `refresh()` when one
arrives or the app comes back to the foreground.

Push goes through Expo's push service. The web app registers the
`ExponentPushToken[...]` with `/api/app` (`device`), and `api/_push.js`
sends to any token of that shape through `exp.host`. The APNs key lives in
the EAS project (set up once, below), so nothing about push needs
configuring in Vercel.

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

- Give App Review a demo login (a real customer-style account on a demo
  site with a few visits, requests and messages in it). Both stores reject
  login-only apps without one.
- The app has no signup, no prices and nothing to buy, on purpose: the
  subscription is for the website, bought on the website, and the app is
  its companion. Say so in the review notes.
- Notifications are asked for after login, not at launch.
