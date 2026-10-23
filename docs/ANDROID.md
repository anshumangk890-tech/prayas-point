# Android delivery path and Back behavior

The current repository is a server-rendered Next.js application. **No Android SDK, Gradle project, APK or AAB is present in this sandbox.** It cannot be safely packaged with `next export` because authentication, admin operations and scoring use live server routes and PostgreSQL.

## Behavior already implemented

Student navigation uses a screen stack and browser history. Back closes a drawer/dialog before navigating, returns one nested screen at a time, and preserves in-progress quiz answers through server autosave plus a local interruption buffer. On root Home, the first browser Back shows **“Press back again to exit”** and a second Back inside two seconds leaves the web history guard. Browsers cannot promise to exit an Android activity.

The optional `@capacitor/app` listener in `src/components/StudentApp.tsx` runs only when `Capacitor.isNativePlatform()` is Android. It delegates overlays and nested screens to normal navigation. On root Home it shows the message on the first native Back and calls Capacitor `App.exitApp()` on the second within two seconds, which is the plugin's documented activity-exit behavior. The listener is removed on unmount. This source is **not device-tested** until a native wrapper exists.

## Recommended production Android path

1. Keep the authenticated Next.js API and PostgreSQL server behind HTTPS, and build a bundled Flutter or statically bundled Capacitor student client that calls those APIs. Reuse the content, profile and attempt contracts; keep all secrets on the server.
2. For native Flutter phone auth, configure Firebase Android Phone Authentication with the Android package name, SHA-1/SHA-256 signing fingerprints, Play Integrity/reCAPTCHA as required and a development Firebase project. The web reCAPTCHA flow in this repo is not a native Flutter implementation.
3. If using Capacitor, create a proper bundled web client and install `@capacitor/cli` and `@capacitor/android` matching the installed Capacitor 7 runtime. Run `npx cap init`, `npx cap add android`, build/copy the bundled client with `npx cap sync android`, then open Android Studio with `npx cap open android`. The server-rendered Next.js output here is **not** a valid `webDir` by itself. A remote `server.url` can help a development prototype but is not a substitute for a reviewed, offline-capable release bundle.
4. Configure Android icons, signing keys, network security, privacy policy, notification permission and Firebase Messaging for Android. Build signed APK/AAB in Android Studio or Gradle only after those steps.
5. Test hardware Back and gesture Back: first Home Back shows one toast, second within 2 seconds exits, after 2 seconds resets; drawers/dialogs close first; nested pages pop once; an unfinished test remains resumable; verify background/reconnect and font scaling on low-end devices.

Until a native package is built and tested, do not describe this preview as a shipped Android app or claim an APK exists.
