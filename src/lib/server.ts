import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, count, eq, gt, lt } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { db } from "@/db";
import { adminAccounts, authRateLimits, sessions, users } from "@/db/schema";

const COOKIE_NAME = "exam_session";
const SESSION_DAYS = 30;

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  if (process.env.NODE_ENV !== "production") console.error("API error", error);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) throw new ApiError(403, "Request origin not allowed.");
}

export async function createSession(principalId: string, role: "student" | "admin") {
  const token = randomBytes(40).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ tokenHash: digest(token), principalId, role, expiresAt });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt,
  });
}

export async function destroySession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, digest(token)));
  (await cookies()).delete(COOKIE_NAME);
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [session] = await db.select().from(sessions).where(and(eq(sessions.tokenHash, digest(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!session) return null;
  if (session.role === "admin") {
    const [admin] = await db.select().from(adminAccounts).where(eq(adminAccounts.id, session.principalId)).limit(1);
    return admin ? { role: "admin" as const, admin } : null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, session.principalId)).limit(1);
  return user ? { role: "student" as const, user } : null;
}

export async function requireStudent() {
  const session = await getSession();
  if (!session || session.role !== "student") throw new ApiError(401, "Please sign in to continue.");
  return session.user;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new ApiError(403, "Administrator access required.");
  return session.admin;
}

export function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id, name: user.name, phoneNumber: user.phoneNumber, verifiedPhone: user.verifiedPhone,
    email: user.email, state: user.state, goalExamId: user.goalExamId,
    preferredLanguage: user.preferredLanguage, notificationsEnabled: user.notificationsEnabled,
    registrationCompleted: user.registrationCompleted, isDemo: user.isDemo,
  };
}

export function firebaseConfigured() {
  const webValues = [
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  ];
  return webValues.every((value) => Boolean(value?.trim())) && Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  );
}

export function firebaseAdminAuth() {
  if (!firebaseConfigured()) throw new ApiError(503, "Phone verification is not configured yet.");
  if (!getApps().length) {
    const serviceJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    let credential;
    if (serviceJson) {
      let serviceAccount: { project_id?: string };
      try { serviceAccount = JSON.parse(serviceJson); }
      catch { throw new ApiError(503, "Firebase Admin server configuration is invalid."); }
      if (!serviceAccount || typeof serviceAccount !== "object" || serviceAccount.project_id !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        throw new ApiError(503, "Firebase Web and Admin project IDs do not match.");
      }
      credential = cert(serviceAccount as Parameters<typeof cert>[0]);
    } else {
      credential = applicationDefault();
    }
    initializeApp({ credential, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  }
  return getAuth();
}

export async function ensureAdminProvisioned() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password || !/^\S+@\S+\.\S+$/.test(email) || password.length < 16) return;
  const [existing] = await db.select({ id: adminAccounts.id }).from(adminAccounts).where(eq(adminAccounts.email, email)).limit(1);
  if (!existing) {
    await db.insert(adminAccounts).values({ id: randomUUID(), email, displayName: "Administrator", passwordHash: await hash(password, 12) }).onConflictDoNothing();
  }
}

export async function verifyAdminCredentials(email: string, password: string) {
  await ensureAdminProvisioned();
  const [admin] = await db.select().from(adminAccounts).where(eq(adminAccounts.email, email.toLowerCase())).limit(1);
  if (!admin || !(await compare(password, admin.passwordHash))) throw new ApiError(401, "Incorrect email or password.");
  return admin;
}

export async function limitAuthAttempt(kind: string, max: number, minutes: number) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "local").split(",")[0].trim();
  const ipHash = digest(ip + ":" + kind);
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const [result] = await db.select({ total: count() }).from(authRateLimits).where(and(eq(authRateLimits.ipHash, ipHash), eq(authRateLimits.kind, kind), gt(authRateLimits.createdAt, cutoff)));
  if ((result?.total ?? 0) >= max) throw new ApiError(429, "Too many attempts. Please try again later.");
  await db.insert(authRateLimits).values({ id: randomUUID(), ipHash, kind });
  if (Math.random() < 0.02) await db.delete(authRateLimits).where(lt(authRateLimits.createdAt, new Date(Date.now() - 86400_000)));
}
