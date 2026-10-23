import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getMessaging } from "firebase-admin/messaging";
import { z } from "zod";
import { db } from "@/db";
import { appSettings, auditLogs, banners, documentFiles, documents, examCategories, jobAlerts, notifications, pushTokens, questions, quizzes, subjects, testAttempts, topics, users } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { ApiError, checkOrigin, firebaseAdminAuth, jsonError, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";
const id = z.string().min(1).max(120);
const text = (max = 200) => z.string().trim().min(1).max(max);
const optional = (max = 500) => z.string().trim().max(max).default("");
const safeUrl = z.union([z.literal(""), z.url().refine((url) => url.startsWith("https://"), "Use an HTTPS URL")]);
const imageUrl = z.string().max(500).refine((value) => !value || value.startsWith("/images/") && !value.includes("..") || value.startsWith("https://"), "Use a local /images/ path or HTTPS URL");
const destination = z.enum(["", "home", "syllabus", "quizzes", "tests", "library", "progress", "job-alerts", "documents", "papers"]);
const categorySchema = z.object({ name: text(100), groupName: text(100), description: optional(300), isActive: z.boolean(), sortOrder: z.coerce.number().int().min(0).max(1000) });
const subjectSchema = z.object({ examId: id, name: text(120), nameHi: optional(120), sortOrder: z.coerce.number().int().min(0).max(1000), isActive: z.boolean() });
const topicSchema = z.object({ subjectId: id, name: text(120), nameHi: optional(120), description: optional(500), sortOrder: z.coerce.number().int().min(0).max(1000), isActive: z.boolean() });
const questionSchema = z.object({
  examId: id, subjectId: id, topicId: id.nullable(), questionText: text(3000),
  options: z.array(z.object({ id: text(12), text: text(1000) })).min(2).max(8),
  correctAnswers: z.array(text(12)).min(1).max(8), questionType: z.enum(["single", "multiple"]),
  explanation: optional(4000), difficulty: z.enum(["easy", "medium", "hard"]),
  language: z.enum(["hi", "en", "bilingual"]), sourceType: z.enum(["original-practice", "licensed-previous-year"]),
  sourceYear: z.coerce.number().int().min(1990).max(2100).nullable(), isPublished: z.boolean(), rightsConfirmed: z.boolean().optional(),
}).superRefine((value, ctx) => {
  const ids = value.options.map((item) => item.id);
  if (new Set(ids).size !== ids.length || value.correctAnswers.some((answer) => !ids.includes(answer)) || new Set(value.correctAnswers).size !== value.correctAnswers.length) ctx.addIssue({ code: "custom", message: "Answer keys must match unique option IDs." });
  if (value.questionType === "single" && value.correctAnswers.length !== 1) ctx.addIssue({ code: "custom", message: "Single-choice questions need one correct answer." });
  if (value.sourceType === "licensed-previous-year" && value.isPublished && (!value.sourceYear || !value.rightsConfirmed)) ctx.addIssue({ code: "custom", message: "Confirm distribution rights and source year before publishing a previous-year question." });
});
const quizSchema = z.object({
  title: text(160), description: optional(600), examId: id, kind: z.enum(["daily", "practice", "mock"]),
  questionIds: z.array(id).min(1).max(200), durationSeconds: z.coerce.number().int().min(60).max(14400),
  scoringConfig: z.object({ correct: z.coerce.number().min(0).max(10), incorrect: z.coerce.number().min(-10).max(0), unanswered: z.coerce.number().min(-10).max(10) }),
  isPublished: z.boolean(),
});
const documentSchema = z.object({
  title: text(180), description: optional(600), examId: id, subjectId: id.nullable(), topicId: id.nullable(),
  documentType: z.enum(["note", "pdf", "paper"]), body: optional(20000), language: z.enum(["hi", "en", "bilingual"]),
  year: z.coerce.number().int().min(1990).max(2100).nullable(), sourceLabel: optional(160),
  downloadAllowed: z.boolean(), isPublished: z.boolean(), rightsConfirmed: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (value.documentType === "paper" && value.isPublished && (!value.year || !value.sourceLabel || !value.rightsConfirmed)) ctx.addIssue({ code: "custom", message: "A previous-year paper requires year, source and confirmed distribution rights." });
});
const bannerSchema = z.object({ title: text(160), subtitle: optional(300), imageUrl, destinationType: destination, destinationId: optional(120), isPublished: z.boolean(), sortOrder: z.coerce.number().int().min(0).max(1000) });
const notificationSchema = z.object({ title: text(160), message: text(1000), targetAudience: id, destinationType: destination, destinationId: optional(120), isPublished: z.boolean(), sendPush: z.boolean().optional() });
const alertSchema = z.object({ title: text(180), summary: text(1000), sourceUrl: safeUrl, sourceLabel: optional(160), isPublished: z.boolean() });
const settingSchema = z.object({ key: z.enum(["appName", "appSubtitle", "logoText", "logoUrl", "supportEmail", "storeUrl"]), value: z.string().trim().max(300) });

async function writeAudit(adminId: string, action: string, resource: string, resourceId: string, detail = "") {
  await db.insert(auditLogs).values({ id: randomUUID(), adminId, action, resource, resourceId, detail });
}

async function deliverPush(notification: { title: string; message: string; targetAudience: string; destinationType: string; destinationId: string }) {
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return "Not configured — saved to in-app inbox only";
  try {
    firebaseAdminAuth();
    const rows = await db.select({ token: pushTokens.token, goalExamId: users.goalExamId, enabled: users.notificationsEnabled })
      .from(pushTokens).innerJoin(users, eq(pushTokens.userId, users.id));
    const tokens = rows.filter((row) => row.enabled && (notification.targetAudience === "all" || row.goalExamId === notification.targetAudience)).map((row) => row.token);
    if (!tokens.length) return "No opted-in devices — saved to in-app inbox";
    let sent = 0;
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const result = await getMessaging().sendEachForMulticast({ tokens: tokens.slice(offset, offset + 500), notification: { title: notification.title, body: notification.message }, data: { destinationType: notification.destinationType, destinationId: notification.destinationId } });
      sent += result.successCount;
    }
    return `Push delivered to ${sent} device${sent === 1 ? "" : "s"}`;
  } catch { return "Push could not be delivered — in-app notification was published"; }
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    await ensureSeed();
    const [categoryRows, subjectRows, topicRows, questionRows, quizRows, documentRows, fileRows, bannerRows, notificationRows, alertRows, settingRows, studentRows, attemptRows, auditRows] = await Promise.all([
      db.select().from(examCategories).orderBy(examCategories.sortOrder), db.select().from(subjects).orderBy(subjects.sortOrder),
      db.select().from(topics).orderBy(topics.sortOrder), db.select().from(questions).orderBy(desc(questions.updatedAt)).limit(500),
      db.select().from(quizzes).orderBy(desc(quizzes.updatedAt)).limit(300), db.select().from(documents).orderBy(desc(documents.updatedAt)).limit(300),
      db.select({ documentId: documentFiles.documentId, sizeBytes: documentFiles.sizeBytes }).from(documentFiles),
      db.select().from(banners).orderBy(banners.sortOrder), db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(200),
      db.select().from(jobAlerts).orderBy(desc(jobAlerts.publishedAt)).limit(200), db.select().from(appSettings),
      db.select({ id: users.id, name: users.name, state: users.state, goalExamId: users.goalExamId, isDemo: users.isDemo, registrationCompleted: users.registrationCompleted, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(100),
      db.select({ id: testAttempts.id, status: testAttempts.status }).from(testAttempts).limit(1000),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50),
    ]);
    const [stats] = await db.select({
      students: sql<number>`(select count(*)::int from users)`,
      attempts: sql<number>`(select count(*)::int from test_attempts where status = 'submitted')`,
      publishedQuestions: sql<number>`(select count(*)::int from questions where is_published = true)`,
      publishedDocuments: sql<number>`(select count(*)::int from documents where is_published = true)`,
    }).from(appSettings).limit(1);
    const fileMap = new Map(fileRows.map((row) => [row.documentId, row.sizeBytes]));
    return Response.json({ admin: { email: admin.email, displayName: admin.displayName }, categories: categoryRows, subjects: subjectRows,
      topics: topicRows, questions: questionRows, quizzes: quizRows,
      documents: documentRows.map((row) => ({ ...row, hasFile: fileMap.has(row.id), fileSize: fileMap.get(row.id) || 0 })),
      banners: bannerRows, notifications: notificationRows, alerts: alertRows, settings: Object.fromEntries(settingRows.map((item) => [item.key, item.value])),
      students: studentRows, audit: auditRows, stats: stats || { students: 0, attempts: 0, publishedQuestions: 0, publishedDocuments: 0 } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin();
    const input = z.object({ resource: z.enum(["categories", "subjects", "topics", "questions", "quizzes", "documents", "banners", "notifications", "alerts", "settings"]), action: z.enum(["create", "update", "delete"]), id: id.optional(), data: z.unknown().optional(), confirm: z.boolean().optional() }).safeParse(await request.json());
    if (!input.success) throw new ApiError(400, "Invalid admin request.");
    const { resource, action, data } = input.data;
    const recordId = action === "create" ? randomUUID() : input.data.id;
    if (!recordId) throw new ApiError(400, "Select a record first.");
    if (action === "delete" && !input.data.confirm) throw new ApiError(400, "Confirm deletion first.");
    let result: unknown = null;
    let pushStatus = "";
    switch (resource) {
      case "categories": {
        if (action === "delete") { await db.delete(examCategories).where(eq(examCategories.id, recordId)); break; }
        const value = categorySchema.parse(data);
        [result] = action === "create" ? await db.insert(examCategories).values({ id: recordId, ...value }).returning() : await db.update(examCategories).set(value).where(eq(examCategories.id, recordId)).returning();
        break;
      }
      case "subjects": {
        if (action === "delete") { await db.delete(subjects).where(eq(subjects.id, recordId)); break; }
        const value = subjectSchema.parse(data);
        [result] = action === "create" ? await db.insert(subjects).values({ id: recordId, ...value }).returning() : await db.update(subjects).set(value).where(eq(subjects.id, recordId)).returning();
        break;
      }
      case "topics": {
        if (action === "delete") { await db.delete(topics).where(eq(topics.id, recordId)); break; }
        const value = topicSchema.parse(data);
        [result] = action === "create" ? await db.insert(topics).values({ id: recordId, ...value }).returning() : await db.update(topics).set({ ...value, updatedAt: new Date() }).where(eq(topics.id, recordId)).returning();
        break;
      }
      case "questions": {
        if (action === "delete") {
          const allQuizzes = await db.select({ id: quizzes.id, questionIds: quizzes.questionIds }).from(quizzes);
          if (allQuizzes.some((quiz) => quiz.questionIds.includes(recordId))) throw new ApiError(409, "Remove this question from quizzes before deleting it.");
          await db.delete(questions).where(eq(questions.id, recordId)); break;
        }
        const { rightsConfirmed: _rights, ...value } = questionSchema.parse(data);
        if (action === "update" && !value.isPublished) {
          const liveTests = await db.select({ id: quizzes.id, questionIds: quizzes.questionIds }).from(quizzes).where(eq(quizzes.isPublished, true));
          if (liveTests.some((quiz) => quiz.questionIds.includes(recordId))) throw new ApiError(409, "Unpublish the tests using this question first.");
        }
        const [subject] = await db.select().from(subjects).where(eq(subjects.id, value.subjectId)).limit(1);
        if (!subject || subject.examId !== value.examId) throw new ApiError(400, "Subject must belong to the selected exam.");
        if (value.topicId) { const [topic] = await db.select().from(topics).where(eq(topics.id, value.topicId)).limit(1); if (!topic || topic.subjectId !== value.subjectId) throw new ApiError(400, "Topic must belong to the selected subject."); }
        [result] = action === "create" ? await db.insert(questions).values({ id: recordId, ...value }).returning() : await db.update(questions).set({ ...value, updatedAt: new Date() }).where(eq(questions.id, recordId)).returning();
        break;
      }
      case "quizzes": {
        if (action === "delete") {
          const [existing] = await db.select({ id: testAttempts.id }).from(testAttempts).where(eq(testAttempts.quizId, recordId)).limit(1);
          if (existing) throw new ApiError(409, "This test has attempts. Unpublish it instead of deleting it.");
          await db.delete(quizzes).where(eq(quizzes.id, recordId)); break;
        }
        const value = quizSchema.parse(data);
        if (new Set(value.questionIds).size !== value.questionIds.length) throw new ApiError(400, "A question cannot be included twice.");
        const selected = await db.select({ id: questions.id, examId: questions.examId, isPublished: questions.isPublished }).from(questions).where(inArray(questions.id, value.questionIds));
        if (selected.length !== value.questionIds.length || selected.some((q) => q.examId !== value.examId || (value.isPublished && !q.isPublished))) throw new ApiError(400, "Published tests require published questions from the same exam.");
        [result] = action === "create" ? await db.insert(quizzes).values({ id: recordId, ...value }).returning() : await db.update(quizzes).set({ ...value, updatedAt: new Date() }).where(eq(quizzes.id, recordId)).returning();
        break;
      }
      case "documents": {
        if (action === "delete") { await db.delete(documents).where(eq(documents.id, recordId)); break; }
        const { rightsConfirmed: _rights, ...value } = documentSchema.parse(data);
        if (value.documentType !== "note" && value.isPublished) {
          const [file] = await db.select({ documentId: documentFiles.documentId }).from(documentFiles).where(eq(documentFiles.documentId, recordId)).limit(1);
          if (!file) throw new ApiError(400, "Upload a PDF before publishing this document.");
        }
        [result] = action === "create" ? await db.insert(documents).values({ id: recordId, ...value }).returning() : await db.update(documents).set({ ...value, updatedAt: new Date() }).where(eq(documents.id, recordId)).returning();
        break;
      }
      case "banners": {
        if (action === "delete") { await db.delete(banners).where(eq(banners.id, recordId)); break; }
        const value = bannerSchema.parse(data);
        [result] = action === "create" ? await db.insert(banners).values({ id: recordId, ...value }).returning() : await db.update(banners).set(value).where(eq(banners.id, recordId)).returning();
        break;
      }
      case "notifications": {
        if (action === "delete") { await db.delete(notifications).where(eq(notifications.id, recordId)); break; }
        const { sendPush, ...value } = notificationSchema.parse(data);
        if (value.targetAudience !== "all") {
          const [exam] = await db.select({ id: examCategories.id }).from(examCategories).where(eq(examCategories.id, value.targetAudience)).limit(1);
          if (!exam) throw new ApiError(400, "Invalid notification audience.");
        }
        const [prior] = action === "update" ? await db.select().from(notifications).where(eq(notifications.id, recordId)).limit(1) : [undefined];
        const publishedAt = value.isPublished ? prior?.publishedAt || new Date() : null;
        [result] = action === "create" ? await db.insert(notifications).values({ id: recordId, ...value, publishedAt }).returning() : await db.update(notifications).set({ ...value, publishedAt }).where(eq(notifications.id, recordId)).returning();
        if (sendPush && value.isPublished && !prior?.isPublished) pushStatus = await deliverPush(value);
        else if (sendPush) pushStatus = "Push is available only when publishing a new notification";
        break;
      }
      case "alerts": {
        if (action === "delete") { await db.delete(jobAlerts).where(eq(jobAlerts.id, recordId)); break; }
        const value = alertSchema.parse(data);
        if (value.isPublished && (!value.sourceUrl || !value.sourceLabel)) throw new ApiError(400, "A verified official source URL and label are required to publish an alert.");
        [result] = action === "create" ? await db.insert(jobAlerts).values({ id: recordId, ...value }).returning() : await db.update(jobAlerts).set(value).where(eq(jobAlerts.id, recordId)).returning();
        break;
      }
      case "settings": {
        if (action === "delete") throw new ApiError(400, "Brand settings cannot be deleted.");
        const value = settingSchema.parse(data);
        if (value.key === "logoUrl" && value.value) imageUrl.parse(value.value);
        if (value.key === "storeUrl" && value.value) safeUrl.parse(value.value);
        if (value.key === "supportEmail" && value.value) z.email().parse(value.value);
        [result] = await db.insert(appSettings).values({ key: value.key, value: value.value }).onConflictDoUpdate({ target: appSettings.key, set: { value: value.value, updatedAt: new Date() } }).returning();
        break;
      }
    }
    if (action !== "delete" && !result) throw new ApiError(404, "Record not found.");
    await writeAudit(admin.id, action, resource, recordId, resource === "notifications" && pushStatus ? pushStatus : "");
    return Response.json({ ok: true, record: result, pushStatus });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "Please check the form fields." }, { status: 400 });
    if (error && typeof error === "object" && "code" in error && error.code === "23503") return Response.json({ error: "This record is still used by other content. Unpublish it or remove related content first." }, { status: 409 });
    return jsonError(error);
  }
}
