import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, banners, bookmarks, documentFiles, documentOpens, documents, examCategories, jobAlerts, notificationReads, notifications, questions, quizzes, subjects, testAttempts, topicProgress, topics, users } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { publicAttempt } from "@/lib/attempt-model";
import { publicUser } from "@/lib/server";

export async function getAppData(user: typeof users.$inferSelect) {
  await ensureSeed();
  const [categories, subjectRows, topicRows, quizRows, documentRows, fileRows, bannerRows, notificationRows, readRows, alertRows, attemptRows, bookmarkRows, progressRows, openRows, settingRows] = await Promise.all([
    db.select().from(examCategories).orderBy(examCategories.sortOrder),
    db.select().from(subjects).where(eq(subjects.isActive, true)).orderBy(subjects.sortOrder),
    db.select().from(topics).where(eq(topics.isActive, true)).orderBy(topics.sortOrder),
    db.select().from(quizzes).where(eq(quizzes.isPublished, true)).orderBy(desc(quizzes.createdAt)),
    db.select().from(documents).where(eq(documents.isPublished, true)).orderBy(desc(documents.createdAt)),
    db.select({ documentId: documentFiles.documentId }).from(documentFiles),
    db.select().from(banners).where(eq(banners.isPublished, true)).orderBy(banners.sortOrder),
    db.select().from(notifications).where(eq(notifications.isPublished, true)).orderBy(desc(notifications.publishedAt)).limit(50),
    db.select().from(notificationReads).where(eq(notificationReads.userId, user.id)),
    db.select().from(jobAlerts).where(eq(jobAlerts.isPublished, true)).orderBy(desc(jobAlerts.publishedAt)).limit(50),
    db.select().from(testAttempts).where(eq(testAttempts.userId, user.id)).orderBy(desc(testAttempts.startedAt)).limit(100),
    db.select().from(bookmarks).where(eq(bookmarks.userId, user.id)),
    db.select().from(topicProgress).where(eq(topicProgress.userId, user.id)),
    db.select().from(documentOpens).where(eq(documentOpens.userId, user.id)).orderBy(desc(documentOpens.openedAt)).limit(20),
    db.select().from(appSettings),
  ]);
  const files = new Set(fileRows.map((row) => row.documentId));
  const read = new Set(readRows.map((row) => row.notificationId));
  const submitted = attemptRows.filter((attempt) => attempt.status === "submitted");
  const legacy = submitted.filter((attempt) => !attempt.questionsSnapshot?.length);
  const attemptedQuizzes = legacy.length ? await db.select().from(quizzes).where(inArray(quizzes.id, [...new Set(legacy.map((attempt) => attempt.quizId))])) : [];
  const questionIds = [...new Set(attemptedQuizzes.flatMap((quiz) => quiz.questionIds))];
  const attemptedQuestions = questionIds.length ? await db.select().from(questions).where(inArray(questions.id, questionIds)) : [];
  const questionMap = new Map(attemptedQuestions.map((question) => [question.id, question]));
  const quizMap = new Map(attemptedQuizzes.map((quiz) => [quiz.id, quiz]));
  const subjectPerformance: Record<string, { correct: number; total: number; attempted: number }> = {};
  for (const attempt of submitted) {
    const quiz = quizMap.get(attempt.quizId);
    const attemptQuestions = attempt.questionsSnapshot?.length
      ? attempt.questionsSnapshot
      : (attempt.quizSnapshot?.questionIds || quiz?.questionIds || []).map((id) => questionMap.get(id)).filter((question): question is NonNullable<typeof question> => Boolean(question));
    for (const question of attemptQuestions) {
      const item = subjectPerformance[question.subjectId] || { correct: 0, total: 0, attempted: 0 };
      const selected = attempt.answers[question.id] || [];
      item.total += 1;
      if (selected.length) item.attempted += 1;
      if (selected.length === question.correctAnswers.length && selected.every((answer) => question.correctAnswers.includes(answer))) item.correct += 1;
      subjectPerformance[question.subjectId] = item;
    }
  }
  const activeDays = new Set(submitted.map((attempt) => attempt.submittedAt?.toISOString().slice(0, 10)).filter(Boolean));
  let studyStreak = 0;
  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  if (!activeDays.has(day.toISOString().slice(0, 10))) day.setUTCDate(day.getUTCDate() - 1);
  while (activeDays.has(day.toISOString().slice(0, 10))) { studyStreak += 1; day.setUTCDate(day.getUTCDate() - 1); }
  const now = Date.now();
  return {
    user: publicUser(user), categories, subjects: subjectRows, topics: topicRows,
    quizzes: quizRows.filter((quiz) => (!quiz.availableFrom || quiz.availableFrom.getTime() <= now) && (!quiz.availableUntil || quiz.availableUntil.getTime() >= now)),
    documents: documentRows.map((doc) => ({ ...doc, hasFile: files.has(doc.id) })), banners: bannerRows,
    notifications: notificationRows.filter((note) => note.targetAudience === "all" || note.targetAudience === user.goalExamId).map((note) => ({ ...note, isRead: read.has(note.id) })),
    alerts: alertRows, attempts: attemptRows.map(publicAttempt), bookmarks: bookmarkRows.map(({ itemType, itemId }) => ({ itemType, itemId })), 
    completedTopicIds: progressRows.map((row) => row.topicId), recentDocumentIds: openRows.map((row) => row.documentId),
    subjectPerformance, studyStreak,
    settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])), 
    pushConfigured: Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY && process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID && process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
  };
}

export async function isPublishedItem(itemType: string, itemId: string) {
  if (itemType === "topic") return (await db.select({ id: topics.id }).from(topics).where(and(eq(topics.id, itemId), eq(topics.isActive, true))).limit(1)).length > 0;
  if (itemType === "document") return (await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, itemId), eq(documents.isPublished, true))).limit(1)).length > 0;
  if (itemType === "question") {
    const { questions } = await import("@/db/schema");
    return (await db.select({ id: questions.id }).from(questions).where(and(eq(questions.id, itemId), eq(questions.isPublished, true))).limit(1)).length > 0;
  }
  return false;
}
