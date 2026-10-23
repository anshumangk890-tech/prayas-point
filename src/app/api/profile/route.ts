import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookmarks, documentOpens, documents, examCategories, notificationReads, notifications, pushTokens, topicProgress, users } from "@/db/schema";
import { isPublishedItem } from "@/lib/data";
import { isExamReady } from "@/lib/navigation";
import { INDIAN_STATES } from "@/lib/types";
import { ApiError, checkOrigin, destroySession, firebaseAdminAuth, jsonError, publicUser, requireStudent } from "@/lib/server";

export const dynamic = "force-dynamic";
const profileSchema = z.object({
  name: z.string().trim().min(2).max(80), email: z.email().max(254), state: z.string().max(80),
  goalExamId: z.string().max(80), preferredLanguage: z.enum(["hi", "en"]),
  notificationsEnabled: z.boolean(), completeRegistration: z.boolean().optional(), consent: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireStudent();
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Please enter a valid name, email and state.");
    const input = parsed.data;
    if (!INDIAN_STATES.includes(input.state)) throw new ApiError(400, "Please select a state or union territory.");
    const [goal] = await db.select().from(examCategories).where(and(eq(examCategories.id, input.goalExamId), eq(examCategories.isActive, true))).limit(1);
    if (!goal || !isExamReady(goal)) throw new ApiError(400, "This exam is coming soon.");
    if (input.completeRegistration && !user.registrationCompleted && !input.consent) throw new ApiError(400, "Please accept the privacy policy to continue.");
    const [updated] = await db.update(users).set({
      name: input.name, email: input.email, state: input.state, goalExamId: goal.id,
      preferredLanguage: input.preferredLanguage, notificationsEnabled: input.notificationsEnabled,
      registrationCompleted: user.registrationCompleted || Boolean(input.completeRegistration),
      privacyAcceptedAt: !user.registrationCompleted && input.completeRegistration ? new Date() : user.privacyAcceptedAt,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id)).returning();
    return Response.json({ user: publicUser(updated) });
  } catch (error) { return jsonError(error); }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("toggleBookmark"), itemType: z.enum(["topic", "document", "question"]), itemId: z.string().min(1).max(120) }),
  z.object({ action: z.literal("toggleTopic"), topicId: z.string().min(1).max(120) }),
  z.object({ action: z.literal("markRead"), notificationId: z.string().min(1).max(120) }),
  z.object({ action: z.literal("markAllRead") }),
  z.object({ action: z.literal("openDocument"), documentId: z.string().min(1).max(120) }),
  z.object({ action: z.literal("updatePreferences"), preferredLanguage: z.enum(["hi", "en"]), notificationsEnabled: z.boolean() }),
  z.object({ action: z.literal("selectGoal"), goalExamId: z.string().min(1).max(120) }),
  z.object({ action: z.literal("registerPush"), token: z.string().min(30).max(4096) }),
]);

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireStudent();
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Invalid request.");
    const input = parsed.data;
    if (input.action === "toggleBookmark") {
      const where = and(eq(bookmarks.userId, user.id), eq(bookmarks.itemType, input.itemType), eq(bookmarks.itemId, input.itemId));
      const [existing] = await db.select().from(bookmarks).where(where).limit(1);
      if (existing) await db.delete(bookmarks).where(where);
      else {
        if (!(await isPublishedItem(input.itemType, input.itemId))) throw new ApiError(404, "Content not found.");
        await db.insert(bookmarks).values({ userId: user.id, itemType: input.itemType, itemId: input.itemId }).onConflictDoNothing();
      }
      return Response.json({ saved: !existing });
    }
    if (input.action === "toggleTopic") {
      if (!(await isPublishedItem("topic", input.topicId))) throw new ApiError(404, "Topic not found.");
      const where = and(eq(topicProgress.userId, user.id), eq(topicProgress.topicId, input.topicId));
      const [existing] = await db.select().from(topicProgress).where(where).limit(1);
      if (existing) await db.delete(topicProgress).where(where);
      else await db.insert(topicProgress).values({ userId: user.id, topicId: input.topicId }).onConflictDoNothing();
      return Response.json({ completed: !existing });
    }
    if (input.action === "markRead") {
      const [note] = await db.select().from(notifications).where(and(eq(notifications.id, input.notificationId), eq(notifications.isPublished, true))).limit(1);
      if (!note || (note.targetAudience !== "all" && note.targetAudience !== user.goalExamId)) throw new ApiError(404, "Notification not found.");
      await db.insert(notificationReads).values({ userId: user.id, notificationId: note.id }).onConflictDoNothing();
      return Response.json({ ok: true });
    }
    if (input.action === "markAllRead") {
      const notes = await db.select().from(notifications).where(eq(notifications.isPublished, true));
      const visible = notes.filter((note) => note.targetAudience === "all" || note.targetAudience === user.goalExamId);
      if (visible.length) await db.insert(notificationReads).values(visible.map((note) => ({ userId: user.id, notificationId: note.id }))).onConflictDoNothing();
      return Response.json({ ok: true });
    }
    if (input.action === "openDocument") {
      const [document] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, input.documentId), eq(documents.isPublished, true))).limit(1);
      if (!document) throw new ApiError(404, "Document not found.");
      await db.insert(documentOpens).values({ userId: user.id, documentId: document.id }).onConflictDoUpdate({ target: [documentOpens.userId, documentOpens.documentId], set: { openedAt: new Date() } });
      return Response.json({ ok: true });
    }
    if (input.action === "updatePreferences") {
      const [updated] = await db.update(users).set({ preferredLanguage: input.preferredLanguage, notificationsEnabled: input.notificationsEnabled, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
      if (!input.notificationsEnabled) await db.delete(pushTokens).where(eq(pushTokens.userId, user.id));
      return Response.json({ user: publicUser(updated) });
    }
    if (input.action === "selectGoal") {
      const [goal] = await db.select().from(examCategories).where(and(eq(examCategories.id, input.goalExamId), eq(examCategories.isActive, true))).limit(1);
      if (!goal || !isExamReady(goal)) throw new ApiError(400, "This exam is coming soon.");
      const [updated] = await db.update(users).set({ goalExamId: goal.id, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
      return Response.json({ user: publicUser(updated) });
    }
    if (!user.notificationsEnabled) throw new ApiError(400, "Enable notifications in Settings first.");
    await db.insert(pushTokens).values({ token: input.token, userId: user.id }).onConflictDoUpdate({ target: pushTokens.token, set: { userId: user.id, updatedAt: new Date() } });
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireStudent();
    const input = z.object({ confirmation: z.literal("DELETE"), idToken: z.string().optional() }).safeParse(await request.json());
    if (!input.success) throw new ApiError(400, "Type DELETE to confirm account deletion.");
    if (!user.isDemo) {
      if (!input.data.idToken) throw new ApiError(401, "Please verify your phone again before deleting your account.");
      const decoded = await firebaseAdminAuth().verifyIdToken(input.data.idToken, true).catch(() => null);
      if (!decoded || decoded.uid !== user.id || Date.now() / 1000 - decoded.auth_time > 300) throw new ApiError(401, "Recent phone verification is required.");
      await firebaseAdminAuth().deleteUser(user.id);
    }
    await db.delete(users).where(eq(users.id, user.id));
    await destroySession();
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
