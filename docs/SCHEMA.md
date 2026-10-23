# Persistent data schema and access model

The runnable deployment uses **PostgreSQL through Drizzle ORM** (`src/db/schema.ts`), not Firestore. Drizzle definitions are the source of truth; apply changes with `npx drizzle-kit push` in this sandbox and use reviewed migrations for a production deployment.

| Table | Purpose / important fields | Access boundary |
|---|---|---|
| `users` | Firebase UID (retained verified-account path), `guest-*` session ID, or legacy `demo-*` ID; profile, verified-phone flag, goal, language, consent timestamp | Current session owner only; limited admin list without phone/email |
| `sessions` | SHA-256 hash of random cookie token, role, principal, expiry | Server only; HTTP-only SameSite cookie |
| `admin_accounts`, `auth_rate_limits` | Bcrypt password hashes and throttling metadata | Server only; no public signup |
| `exam_categories`, `subjects`, `topics` | Active flags, category grouping, bilingual topic names, sort order | Published/active student read; admin write |
| `questions` | Options JSON, server-only correct answers, explanations, source and publish state | Admin CRUD; active attempt receives sanitized options only |
| `quizzes` | Ordered question IDs, kind, duration, scoring configuration, availability | Published student read; admin CRUD |
| `test_attempts` | Owner, answers, review flags, server timestamps, score, accuracy, status, nullable private `questions_snapshot` and `quiz_snapshot` JSONB | Owner read/write through attempt API; server scores; snapshots are never returned before submission |
| `documents`, `document_files` | Metadata and protected base64 PDF bytes (8 MB limit) | Published student read; permitted downloads only; admin upload |
| `banners`, `notifications`, `job_alerts`, `app_settings` | Admin-published home/inbox/notices/brand | Published student read; admin write |
| `notification_reads`, `bookmarks`, `topic_progress`, `document_opens` | Per-user inbox and study state | Current owner only |
| `push_tokens` | Optional device tokens attached to current user | Server-only registration and admin-triggered send |
| `audit_logs` | Admin ID, action, resource, timestamp | Admin read; server write |

Indexes cover owner/attempt lookups, category ordering, content publish lookups, session expiry and audit history. Question choices, answers, scoring config and attempted answers use typed JSONB. New attempts snapshot question order/text/options/**private correct answers**/explanations and the quiz's duration/scoring config. `src/lib/attempt-model.ts` projects safe attempt fields for the dashboard and test API; correct keys are sent only in the owning student's **submitted** review. Older rows have null snapshots and retain a live-content fallback, so their reviews can change after an admin edit. IDs are text to support Firebase UIDs, `guest-*` sessions and imported content IDs. A guest uses the existing `is_demo` database marker solely to identify an unverified, non-Firebase owner; no name, phone number or verified identity is fabricated. Its random HTTP-only server session restores that owner's real activity on reload. Closing the guest session removes its user row and dependent progress through database cascades; it cannot be recovered as a phone account. No student can specify another user's ID in a mutation; the server resolves it from the session. Students cannot change any role field through an API, and the admin list intentionally excludes student phone numbers and emails. Firestore security rules in this repository deny all access because Firestore is not the database in this deployment.

For a future Firestore migration, map the tables to owner-scoped `users/{uid}` subcollections and admin-published content collections. Use Firebase custom claims assigned by a trusted server for admin writes, validate fields in rules and send notifications via server functions. Add compound indexes for `(examId, isPublished, sortOrder)`, `(userId, startedAt)` and `(targetAudience, publishedAt)`. Do **not** deploy open test rules. The included Firestore and Storage rules deny all because neither product is used by this running app.
