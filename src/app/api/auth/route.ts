import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAppData } from "@/lib/data";
import { ensureSeed } from "@/lib/seed";
import { ApiError, checkOrigin, createSession, destroySession, firebaseAdminAuth, firebaseConfigured, getSession, jsonError, limitAuthAttempt, verifyAdminCredentials } from "@/lib/server";

export const dynamic = "force-dynamic";
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("guest") }),
  z.object({ action: z.literal("demo") }),
  z.object({ action: z.literal("firebase"), idToken: z.string().min(50).max(10000) }),
  z.object({ action: z.literal("admin"), email: z.email().max(254), password: z.string().min(1).max(200) }),
  z.object({ action: z.literal("logout") }),
]);

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Please check your details and try again.");
    const input = parsed.data;
    if (input.action === "logout") {
      const current = await getSession();
      if (current?.role === "student" && current.user.isDemo && current.user.id.startsWith("guest-")) {
        await db.delete(users).where(eq(users.id, current.user.id));
      }
      await destroySession();
      return Response.json({ ok: true });
    }
    await ensureSeed();
    if (input.action === "admin") {
      await limitAuthAttempt("admin-login", 6, 15);
      const admin = await verifyAdminCredentials(input.email, input.password);
      await destroySession();
      await createSession(admin.id, "admin");
      return Response.json({ ok: true, role: "admin" });
    }
    if (input.action === "guest") {
      const current = await getSession();
      if (current?.role === "admin") throw new ApiError(403, "Sign out of Admin Studio before opening a guest study session.");
      if (current?.role === "student") {
        if (!current.user.registrationCompleted) throw new ApiError(409, "Finish your existing profile registration before starting a new study session.");
        return Response.json({ ok: true, data: await getAppData(current.user) }, { headers: { "Cache-Control": "no-store" } });
      }
      await limitAuthAttempt("guest-study", 20, 60);
      // isDemo is the legacy marker for an unverified, non-Firebase student.
      // This is a real isolated guest session, not simulated OTP authentication.
      const [user] = await db.insert(users).values({
        id: `guest-${randomUUID()}`, isDemo: true, registrationCompleted: true,
        goalExamId: "railway-group-d", preferredLanguage: "hi",
      }).returning();
      await destroySession();
      await createSession(user.id, "student");
      return Response.json({ ok: true, data: await getAppData(user) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "demo") {
      await limitAuthAttempt("demo-session", 20, 60);
      const [user] = await db.insert(users).values({ id: `demo-${randomUUID()}`, isDemo: true, registrationCompleted: true, goalExamId: "railway-group-d", preferredLanguage: "hi" }).returning();
      await destroySession();
      await createSession(user.id, "student");
      return Response.json({ ok: true, data: await getAppData(user) });
    }
    if (!firebaseConfigured()) throw new ApiError(503, "Phone sign-in is not configured on this server yet. Use Open for Study on the welcome screen or try later.");
    await limitAuthAttempt("firebase-session", 20, 60);
    let adminAuth;
    try { adminAuth = firebaseAdminAuth(); }
    catch { throw new ApiError(503, "Phone sign-in is temporarily unavailable because Firebase server setup is incomplete."); }
    let decoded;
    try { decoded = await adminAuth.verifyIdToken(input.idToken, true); }
    catch { throw new ApiError(401, "Phone verification expired or could not be confirmed. Please verify your number again."); }
    if (decoded.firebase?.sign_in_provider !== "phone" || decoded.uid.startsWith("demo-")) {
      throw new ApiError(403, "Sign in using Firebase phone verification to continue.");
    }
    const phone = decoded.phone_number;
    if (!phone || !/^\+91[6-9]\d{9}$/.test(phone)) throw new ApiError(400, "A verified Indian mobile number is required.");
    const [existing] = await db.select({ isDemo: users.isDemo }).from(users).where(eq(users.id, decoded.uid)).limit(1);
    if (existing?.isDemo) throw new ApiError(403, "A demo account cannot be used as a verified phone account.");
    const [user] = await db.insert(users).values({ id: decoded.uid, phoneNumber: phone, verifiedPhone: true, registrationCompleted: false })
      .onConflictDoUpdate({ target: users.id, set: { phoneNumber: phone, verifiedPhone: true, updatedAt: new Date() } }).returning();
    await destroySession();
    await createSession(user.id, "student");
    return Response.json({ ok: true, data: await getAppData(user) });
  } catch (error) { return jsonError(error); }
}
