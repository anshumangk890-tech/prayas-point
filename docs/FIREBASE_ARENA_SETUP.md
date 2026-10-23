# Connect Firebase Phone Authentication to Prayas Point

The Firebase project and Web app can exist without being connected to this Arena deployment. The current Prayas Point welcome has **no phone/OTP controls**: its single **Open for Study** action creates an unverified guest session using PostgreSQL. Firebase Web SDK initialization and the server's verified-token endpoint are retained for a future account-login screen, but entering credentials alone will **not** make phone login visible or prove SMS works. Keep private credentials server-side and do not claim OTP is live without a real SMS test.

## 1. Copy the Web app settings (public identifiers)

In your **own Firebase Console**, open **Project settings (gear) → General → Your apps → your Web app (`</>`) → SDK setup and configuration → Config**. Copy the values from the Firebase config object into **Arena project → Environment Variables / Secrets** (or the equivalent project settings). Create these four exact variable names:

| Firebase Web config field | Arena environment variable | Needed for phone OTP? |
| --- | --- | --- |
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes |

These four are Firebase's **public Web SDK identifiers**, not service-account credentials. The browser reads them from `src/lib/firebase-client.ts`; Next.js embeds `NEXT_PUBLIC_*` values into its client build. Add the settings to the **same Arena deployment** serving the app, then rebuild/redeploy. Do not use example strings or enter any values into source files. Do not send your configuration to this chat.

You may see `messagingSenderId` in that config object. `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` and `NEXT_PUBLIC_FIREBASE_VAPID_KEY` are **optional web push** settings. They are not required for Phone Authentication, and push is not part of this setup step. The VAPID key, if used later, comes from **Project settings → Cloud Messaging → Web configuration**.

## 2. Configure server-side token verification (private credential)

If a phone-login UI is deliberately enabled in a future release, its browser flow will verify SMS with Firebase and send an ID token to the Next.js server. The retained server endpoint uses Firebase Admin to verify that token (including revocation), requires the **phone** sign-in provider and a verified `+91` number, and saves/loads the profile in PostgreSQL. None of those steps are part of today's Open for Study guest action.

In Arena's **server-side Environment Variables / Secrets**, configure **one** of these:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete Firebase Admin service-account JSON stored as a **private server secret**; obtain it from **Firebase Console → Project settings → Service accounts → Firebase Admin SDK** using your own project's secure provisioning process. Restrict access to this secret and rotate it if exposed.
- **Or** `GOOGLE_APPLICATION_CREDENTIALS`: an absolute path to a securely mounted service-account file accessible **only to the server**. Set this only if your hosting environment actually mounts that private file (or provides trusted application-default credentials).

Never put a private key or service-account JSON in a `NEXT_PUBLIC_*` variable, client file, Git repository, browser console, screenshot, or message. The Admin credential's Firebase project must match the Web app `projectId`. Keep `DATABASE_URL` configured for the existing PostgreSQL/Drizzle database. Firestore is **not** connected and its rules remain deny-all.

The backend reports `firebaseConfigured: false` from `/api/bootstrap` until the four Web settings **and** one server-side credential are present. The welcome screen does not display this flag or an SMS warning. A `firebaseConfigured: true` value means only that variables are present; it does **not** prove SMS delivery, project permissions, authorized domains, or a visible phone-login UI.

## 3. Finish the Firebase Console settings

1. Confirm **Authentication → Sign-in method → Phone** remains enabled.
2. Open **Authentication → Settings → SMS region policy** and allow **India**. New projects may block every region by default. Review Firebase's quotas, abuse protection, SMS charges and any billing requirement before sending real messages.
3. Open **Authentication → Settings → Authorized domains**. Add the **exact hostname** of your HTTPS Arena preview or deployed custom domain, without `https://`, a port, or a path. Preview hostnames can change; add the current hostname or use a stable deployed domain. Do not assume `localhost` works for hosted web phone SMS authentication.
4. If your Firebase API key has restrictions, ensure they allow the actual hosting domain and the APIs required by Firebase Authentication. Do not disable restrictions blindly.

Firebase's `RecaptchaVerifier` handles the web anti-abuse challenge. Do not add a hardcoded OTP, disable verification in production, or confuse Firebase's fictional development test numbers with proof of real SMS delivery.

## 4. Test any future visible phone-login flow

The current welcome does **not** expose an OTP form, even if Firebase environment variables are filled in. If a future release deliberately adds that entry, test it on an authorized HTTPS domain before launch:

1. Request SMS to a permitted Indian number, complete Firebase reCAPTCHA, and confirm a real message arrives. A config flag alone is not a successful OTP test.
2. Confirm incorrect and expired codes are rejected, resend obeys its countdown, and network/quota errors are explained. Check domain, SMS region, API-key restrictions, quota and billing if Firebase rejects a request.
3. Enter the delivered code, complete profile registration, reload and sign in again to verify that the same owner's PostgreSQL profile returns. Test account deletion and sign-out as well.
4. Never log SMS codes, ID tokens, service-account credentials or student phone numbers. Firebase fictional test numbers do not prove real SMS delivery.

The app remains a **Next.js web app**. An Android APK/native phone-auth test requires a separate Android build and Firebase Android app configuration; the web SMS flow does not prove native Android behavior.
