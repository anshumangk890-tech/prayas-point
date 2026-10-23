# Prayas Point (प्रयास पॉइंट)

**रेलवे ग्रुप डी की पूरी तैयारी**

An Android-first **responsive web application** for Indian government-exam learners. Railway Group D is the only active category. SSC, Banking, other Railway and UP exams remain visibly **Coming Soon**. The app has no ads, payment SDK, checkout, prices, sponsored placements or promotional notifications.

The official name and Hindi subtitle are shared by login, splash, navigation and web manifest. On first app bootstrap, only the old placeholder value in PostgreSQL is updated to **Prayas Point**; a name previously customized by an administrator is preserved. The in-app display name, Hindi subtitle and logo URL remain editable under **Admin Studio → Brand & support**. Browser metadata and the install manifest use the official name from source.

## What this repository actually runs

This sandbox provides Next.js 16, React 19 and PostgreSQL/Drizzle—not a Flutter/Android build environment. The visible welcome screen now opens an **unverified guest study session** through the existing Next.js API. PostgreSQL stores each session’s real study activity and published learning content. Firebase Phone Authentication code, server verification, and environment variables remain in the project for a future account-login experience, but the welcome screen deliberately exposes no phone, OTP, or SMS UI and does not claim Firebase sign-in. PDFs up to 8 MB are stored server-side in PostgreSQL in this deployment, not Firebase Storage. FCM web push is optional and inactive until configured. No APK/AAB was built.

### Implemented

- Branded splash and one-button **Open for Study** welcome; an owner-scoped, unverified guest session; profile editing, session cleanup and account deletion. The existing Firebase Phone Auth backend and verified-account registration code remain available for future account access but are not shown on the welcome screen.
- Responsive student dashboard, red app bar, drawer, exam selection/search, five-item bottom navigation, notifications, settings, help, privacy and terms.
- Group D syllabus with search, bookmarks and completion; original sample practice questions; daily/topic practice and a **starter mini mock**, not an official full-length mock or previous-year material.
- Timed attempts with question palette, review markers, autosave plus local interruption buffer, server-side answer validation/scoring, results, explanations, retry and real progress history. New attempts snapshot the questions and scoring rules privately at start so later admin edits cannot change a saved result; older attempts retain a legacy live-content fallback.
- Notes, admin PDF upload/viewing, permitted browser-offline PDF cache, downloads management and a previous-paper library that starts empty until rights-cleared files are published.
- Separate protected admin dashboard with CRUD for categories, subjects, topics, questions, quizzes, documents, banners, notifications, job alerts and branding; status controls, audit entries and limited student overview.
- Role checks on every admin API, HTTP-only random-token sessions, login throttling, same-origin mutation checks and no answer keys sent to an active attempt.
- Browser Back handling with a two-second Home prompt; an optional Capacitor Android Back listener calls the native activity-exit API **only if packaged in a native wrapper**.

## Local setup

1. Use Node.js 22 or newer and a PostgreSQL database. Run `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` (the sandbox already has a local database URL).
3. Run `npx drizzle-kit push` to create tables and indexes. Drizzle schema is in `src/db/schema.ts`.
4. Run `npm run dev`, then visit `/`. The first `/api/bootstrap` request inserts transparent sample practice content if it is absent.
5. Choose **Open for Study**. The server creates an isolated guest study session with no phone number or fabricated name. Your real attempts and progress persist while its browser session is valid; signing out closes the session and deletes its guest records. A guest session cannot be recovered as a verified account.
6. Run `node scripts/smoke-test.mjs` and `node scripts/backend-phases-test.mjs` while the app is running. The second test creates temporary admin/student records to check profile persistence, owner isolation, private answer keys, server scoring, immutable results and retry; it cleans up its fixtures afterward. Run these against a **development database**, not production.
7. For a browser navigation regression, run `npx playwright install chromium` (and `npx playwright install-deps chromium` on Linux if required), then `node scripts/navigation-e2e.mjs`. This test creates temporary guest study sessions and removes them.

For production use a managed PostgreSQL service, HTTPS, backups, request/body limits at the proxy, secret management and a real file/object-storage service for larger PDFs. Do not treat the sample question bank as genuine previous-year material.

## Firebase phone OTP — retained backend, not shown on welcome

The current welcome screen intentionally has **no phone or OTP entry**. Firebase Web SDK initialization, the protected token-exchange API, and environment variable names are retained for a future verified-account flow; setting credentials alone will **not** re-enable a phone screen. Guest study access works independently through a server-issued session. For a future verified-account release, use [Arena Firebase setup and the real-SMS test checklist](docs/FIREBASE_ARENA_SETUP.md), add an explicit phone-login entry, and test it before claiming OTP works.

1. In your **development** Firebase project, confirm the registered **Web app** and enabled **Authentication → Sign-in method → Phone**. In Authentication → Settings → **SMS region policy**, allow India (+91); a new project may block all SMS regions by default. Review Firebase SMS quotas, anti-abuse controls and any required billing.
2. In Authentication → Settings → **Authorized domains**, add the exact HTTPS hostname where this Next.js app runs (and each staging hostname). Firebase's web Phone Authentication guide does not permit `localhost` as the phone-auth hosted domain; use an authorized HTTPS development deployment to test actual SMS/reCAPTCHA. Do not use an unauthorized preview domain.
3. Put the Web app's `apiKey`, `authDomain`, `projectId` and `appId` into `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `NEXT_PUBLIC_FIREBASE_APP_ID` in `.env` or deployment environment settings. These are Firebase **public web identifiers**, not a private service credential. Rebuild/redeploy after changing `NEXT_PUBLIC_*` variables.
4. Give **only the Next.js server** a Firebase Admin service account using `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON as a server secret) **or** `GOOGLE_APPLICATION_CREDENTIALS` (a private file path). Never put it in a `NEXT_PUBLIC_*` value, repository, or downloaded browser bundle. The backend verifies Firebase ID tokens with revocation checking, requires the phone sign-in provider, and takes the UID and `+91` number only from the signed token before creating an HTTP-only app session.
5. **If a verified-account screen is reintroduced later**, test on an authorized HTTPS domain with a real permitted Indian device/number: request SMS, enter the delivered OTP, complete registration, reload, sign out, and sign in again. Firebase Console fictional test numbers can help development but do not prove real SMS delivery. No hardcoded OTP is accepted by this app.
6. For optional push, configure Firebase Cloud Messaging web credentials, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, HTTPS and a service account. A student must opt in via Settings. Admin publishing always creates an in-app inbox record; push reports whether delivery was configured/successful. Foreground/browser/Android notification behavior still needs device testing.

### Exact values this code reads

In **Firebase Console → Project settings (gear) → General → Your apps**, register/select your **Web app** (`</>` icon) and copy its *SDK setup and configuration → Config* fields:

| Environment variable | Copy from Firebase | Location |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web config `apiKey` | `.env` locally / deployment environment; public web identifier |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Web config `authDomain` | Same public environment |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Web config `projectId` | Same public environment |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Web config `appId` | Same public environment |
| `FIREBASE_SERVICE_ACCOUNT_JSON` **or** `GOOGLE_APPLICATION_CREDENTIALS` | Project settings → **Service accounts** → Firebase Admin SDK: private JSON (or a secure path to it) | **Server-only secret**, never `NEXT_PUBLIC_*` or source control |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Web config `messagingSenderId` | Optional public value for push notifications, **not required for OTP** |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Project settings → **Cloud Messaging** → Web configuration → key pair | Optional public value for web push, **not required for OTP** |

`DATABASE_URL` connects Drizzle to PostgreSQL and is **not** a Firebase value. The welcome screen does not read Firebase settings or show a configuration warning. `src/lib/firebase-client.ts` retains the four public Web config fields, and `src/lib/server.ts` retains server-side Admin verification for a future phone flow. The `/api/bootstrap` `firebaseConfigured` flag only indicates whether variables are present; it does not prove SMS works. Never place service-account JSON in a public client file, Git commit, or browser console. A future phone-login UI must be deliberately enabled and tested with a real delivered SMS before claiming OTP works.

**Why not Firestore here?** Next.js can integrate with Firestore, but this existing app already has working PostgreSQL/Drizzle tables, admin publishing and student attempts. Adding Firestore alongside them would create competing sources of truth and risk losing existing progress. This implementation therefore keeps **Firebase Authentication for OTP** and **PostgreSQL/Drizzle for all application data**. It does not write to Firestore or Firebase Storage. The included `firestore.rules` and `storage.rules` deny all access if those unused services are enabled. Migrating later requires a planned data migration, owner/admin security rules, indexes and secure upload functions; do not simply loosen the included rules.

## Admin provisioning

There is **no public admin signup and no default password**. Set server-only `ADMIN_BOOTSTRAP_EMAIL` and a unique, strong `ADMIN_BOOTSTRAP_PASSWORD` (at least 16 characters), start the server and visit `/admin`. The server inserts a bcrypt-hashed administrator once. Remove the bootstrap password from the running environment after provisioning and redeploy/restart. Set a *different* email to provision another authorized administrator. `/api/admin` verifies the server session role on every request; setting a field in the browser cannot grant access. Keep secrets in a secret manager, not source control.

Admin workflow: create questions → publish them → create a quiz with those IDs → publish it. Create PDF metadata as a draft → upload a valid PDF (8 MB max) → publish. Previous-year questions/papers require a source year and explicit rights confirmation. Published job alerts require an official HTTPS source. Unpublishing a question used by a published quiz is blocked. Delete operations require confirmation and are audit-logged. Student phone/email and private answers are omitted from the admin account list.

## Data and access

See `docs/SCHEMA.md`. The visible welcome creates an unverified `guest-*` identity with a random HTTP-only server session; it does **not** pretend to verify a person or phone number. The retained Firebase API verifies phone identity only when a verified-account UI is later enabled and configured. The **Next.js API is the PostgreSQL access boundary** and uses Drizzle for queries. There is no client database password or client-side admin role. Student APIs resolve the owner from the server session, expose only published learning content and that session's own profile/progress, and return 403/404 for unauthorized records. Existing legacy `demo-*` records remain compatible but are no longer the welcome path. New attempts privately store a question/scoring snapshot on the server; active-test responses and dashboard data explicitly omit its answer keys. Submission recomputes and persists the score on the server and is idempotent. Results from older, pre-snapshot attempts may still reflect later edits to their answer review. Offline PDFs are cached under a user-scoped Cache API name; app-managed files and quiz drafts are removed on logout/deletion. A browser may keep files saved outside the app.

### Tested in this sandbox

- Next.js production compilation and TypeScript validation.
- Managed production preview and `/api/health` database health check.
- HTTP guest study session, original practice content, topic completion, hidden active-test answer keys, server-scored submission, persisted progress and 403 on student access to admin APIs.
- `scripts/backend-phases-test.mjs`: invalid Firebase token rejection while unconfigured, persisted profile changes, cross-user attempt denial, temporary admin-published database question/quiz, result stability after edits, and retry with updated rules. Test fixtures were removed.
- `scripts/navigation-e2e.mjs`: 42 groups of mobile/desktop browser checks, including the single Open for Study action, absence of phone/OTP/demo controls, session reload, quiz navigation and guest sign-out cleanup, with no uncaught browser errors. This does **not** validate native Android hardware/gesture Back.
- Temporary strong-password admin login plus banner create/publish/delete; temporary admin account removed afterward.

**Not tested / needs credentials or device:** real SMS delivery and Firebase OTP, FCM delivery, a native Android build, hardware/system-back gestures, real device offline behavior, Play Store listing, large document loads and third-party PDF rights. A web browser cannot close an Android activity by itself. See `docs/ANDROID.md`.

## Phase status

| Phase | Working now | Remaining / configuration |
|---|---|---|
| 1. Structure & navigation | Responsive app, splash, nested browser navigation, optional native Back hook | Native wrapper and gesture/device test |
| 2. Auth & profile | Open for Study creates an unverified guest session with real PostgreSQL progress; Firebase web OTP/token-check code and existing verified-account registration remain in source | No visible OTP entry; a future verified-account UI, project setup, authorized HTTPS domain and real SMS test are required before calling phone sign-in live |
| 3. Home & inbox | Dynamic dashboard, drawer, categories, in-app notices | FCM setup and device delivery test |
| 4. Group D study | Editable syllabus, notes, protected PDFs and permitted offline cache | Rights-cleared PDFs, larger object storage |
| 5. Practice & progress | Server-scored practice and mini mock, private immutable snapshots on new attempts, resume, saved results and browser quiz flow tested | Full-length curated mock bank, legacy attempt backfill, device interruption tests |
| 6. Admin | Protected CRUD, PDF upload, banners, audit and notices | Provision a real admin and editorial review |
| 7. Security & QA | Server role/owner checks, validation, denial rules, smoke test | Security review, dependency audit, load and accessibility device testing |
| 8. Android release | Optional Capacitor Back bridge source | Native project, APK/AAB, signing and release testing |

This is a working web app with an extensible backend, **not** a claim that all external services or an Android binary have already been delivered.
