import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { questions, quizzes, testAttempts } from "@/db/schema";
import type { AnswerMap, AttemptQuestionSnapshot } from "@/db/schema";
import { publicAttempt, snapshotQuestion, snapshotQuiz } from "@/lib/attempt-model";
import { ApiError, checkOrigin, jsonError, requireStudent } from "@/lib/server";

export const dynamic = "force-dynamic";

async function ownedAttempt(id: string, userId: string) {
  const [attempt] = await db.select().from(testAttempts).where(and(eq(testAttempts.id, id), eq(testAttempts.userId, userId))).limit(1);
  if (!attempt) throw new ApiError(404, "Attempt not found.");
  const [currentQuiz] = await db.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).limit(1);
  if (!currentQuiz) throw new ApiError(404, "Test not found.");
  const quiz = attempt.quizSnapshot || snapshotQuiz(currentQuiz);
  // Older attempts predate snapshots. They remain readable, but only new
  // attempts can guarantee an immutable answer review after admin edits.
  let ordered = attempt.questionsSnapshot;
  if (!ordered?.length) {
    const rows = quiz.questionIds.length ? await db.select().from(questions).where(inArray(questions.id, quiz.questionIds)) : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    ordered = quiz.questionIds.map((qid) => byId.get(qid)).filter((row): row is typeof rows[number] => Boolean(row)).map(snapshotQuestion);
  }
  return { attempt, quiz, ordered };
}

function publicQuestion(question: AttemptQuestionSnapshot) {
  return {
    id: question.id, subjectId: question.subjectId, topicId: question.topicId,
    questionText: question.questionText, options: question.options,
    questionType: question.questionType, language: question.language,
  };
}

function sameSet(a: string[], b: string[]) { return a.length === b.length && a.every((value) => b.includes(value)); }

function detail({ attempt, quiz, ordered }: Awaited<ReturnType<typeof ownedAttempt>>) {
  const response: {
    attempt: ReturnType<typeof publicAttempt>;
    quiz: typeof quiz;
    questions: ReturnType<typeof publicQuestion>[];
    review?: Array<ReturnType<typeof publicQuestion> & { correctAnswers: string[]; explanation: string; selectedAnswers: string[]; isCorrect: boolean; sourceType: string }>;
    breakdown?: Array<{ subjectId: string; correct: number; total: number }>;
  } = { attempt: publicAttempt(attempt), quiz, questions: ordered.map(publicQuestion) };
  if (attempt.status === "submitted") {
    response.review = ordered.map((question) => {
      const selected = attempt.answers[question.id] || [];
      return {
        ...publicQuestion(question), correctAnswers: question.correctAnswers,
        explanation: question.explanation, selectedAnswers: selected,
        isCorrect: selected.length > 0 && sameSet(selected, question.correctAnswers), sourceType: question.sourceType,
      };
    });
    const breakdown = new Map<string, { subjectId: string; correct: number; total: number }>();
    for (const item of response.review) {
      const current = breakdown.get(item.subjectId) || { subjectId: item.subjectId, correct: 0, total: 0 };
      current.total += 1;
      if (item.isCorrect) current.correct += 1;
      breakdown.set(item.subjectId, current);
    }
    response.breakdown = [...breakdown.values()];
  }
  return response;
}

function validateAnswers(raw: unknown, ordered: AttemptQuestionSnapshot[]): AnswerMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ApiError(400, "Invalid answers.");
  const input = raw as Record<string, unknown>;
  if (Object.keys(input).length > ordered.length) throw new ApiError(400, "Too many answers.");
  const allowed = new Map(ordered.map((q) => [q.id, q]));
  const result: AnswerMap = {};
  for (const [qid, value] of Object.entries(input)) {
    const question = allowed.get(qid);
    if (!question || !Array.isArray(value) || value.length > (question.questionType === "multiple" ? question.options.length : 1)) throw new ApiError(400, "Invalid answer selection.");
    if (!value.every((option) => typeof option === "string" && question.options.some((choice) => choice.id === option)) || new Set(value).size !== value.length) throw new ApiError(400, "Invalid answer option.");
    if (value.length) result[qid] = value as string[];
  }
  return result;
}

function validateReview(raw: unknown, ordered: AttemptQuestionSnapshot[]) {
  if (!Array.isArray(raw) || raw.length > ordered.length) throw new ApiError(400, "Invalid review list.");
  const ids = new Set(ordered.map((q) => q.id));
  if (!raw.every((id) => typeof id === "string" && ids.has(id))) throw new ApiError(400, "Invalid review question.");
  return [...new Set(raw)] as string[];
}

async function submit(id: string, userId: string, rawAnswers?: unknown, rawReview?: unknown) {
  const bundle = await ownedAttempt(id, userId);
  if (bundle.attempt.status === "submitted") return detail(bundle);
  const deadline = bundle.attempt.startedAt.getTime() + bundle.quiz.durationSeconds * 1000;
  const withinTime = Date.now() <= deadline + 10_000;
  const answers = withinTime && rawAnswers !== undefined ? validateAnswers(rawAnswers, bundle.ordered) : bundle.attempt.answers;
  const reviewIds = withinTime && rawReview !== undefined ? validateReview(rawReview, bundle.ordered) : bundle.attempt.reviewIds;
  let score = 0; let correct = 0; let answered = 0;
  for (const question of bundle.ordered) {
    const selected = answers[question.id] || [];
    if (!selected.length) { score += bundle.quiz.scoringConfig.unanswered; continue; }
    answered += 1;
    if (sameSet(selected, question.correctAnswers)) { correct += 1; score += bundle.quiz.scoringConfig.correct; }
    else score += bundle.quiz.scoringConfig.incorrect;
  }
  const now = new Date();
  const [updated] = await db.update(testAttempts).set({
    answers, reviewIds, score: Math.round(score * 100) / 100,
    accuracy: answered ? Math.round(correct / answered * 10000) / 100 : 0,
    timeTakenSeconds: Math.min(bundle.quiz.durationSeconds, Math.max(0, Math.floor((now.getTime() - bundle.attempt.startedAt.getTime()) / 1000))),
    status: "submitted", submittedAt: now, updatedAt: now,
  }).where(and(eq(testAttempts.id, id), eq(testAttempts.userId, userId), eq(testAttempts.status, "in_progress"))).returning();
  return detail({ ...bundle, attempt: updated || (await ownedAttempt(id, userId)).attempt });
}

export async function GET(request: Request) {
  try {
    const user = await requireStudent();
    const id = new URL(request.url).searchParams.get("id");
    if (!id || id.length > 120) throw new ApiError(400, "Attempt ID is required.");
    const bundle = await ownedAttempt(id, user.id);
    if (bundle.attempt.status === "in_progress" && Date.now() > bundle.attempt.startedAt.getTime() + bundle.quiz.durationSeconds * 1000 + 10_000) {
      return Response.json(await submit(id, user.id), { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(detail(bundle), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireStudent();
    if (!user.registrationCompleted) throw new ApiError(403, "Complete registration before starting a test.");
    const input = await request.json();
    if (input?.action === "start") {
      const parsed = z.object({ action: z.literal("start"), quizId: z.string().min(1).max(120), retry: z.boolean().optional() }).safeParse(input);
      if (!parsed.success) throw new ApiError(400, "Select a valid test.");
      const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, parsed.data.quizId), eq(quizzes.isPublished, true))).limit(1);
      if (!quiz || quiz.examId !== user.goalExamId || (quiz.availableFrom && quiz.availableFrom > new Date()) || (quiz.availableUntil && quiz.availableUntil < new Date())) throw new ApiError(404, "This test is not available.");
      if (!parsed.data.retry) {
        const [existing] = await db.select().from(testAttempts).where(and(eq(testAttempts.userId, user.id), eq(testAttempts.quizId, quiz.id), eq(testAttempts.status, "in_progress"))).limit(1);
        if (existing) {
          const previous = await ownedAttempt(existing.id, user.id);
          if (Date.now() > previous.attempt.startedAt.getTime() + previous.quiz.durationSeconds * 1000 + 10_000) return Response.json(await submit(existing.id, user.id));
          return Response.json(detail(previous));
        }
      }
      if (!quiz.questionIds.length || new Set(quiz.questionIds).size !== quiz.questionIds.length) throw new ApiError(409, "This test is being updated. Please try later.");
      const rows = await db.select().from(questions).where(and(inArray(questions.id, quiz.questionIds), eq(questions.isPublished, true)));
      const byId = new Map(rows.map((row) => [row.id, row]));
      const selected = quiz.questionIds.map((qid) => byId.get(qid));
      if (selected.some((row) => !row || row.examId !== quiz.examId)) throw new ApiError(409, "This test is being updated. Please try later.");
      const ordered = selected as typeof rows;
      const [attempt] = await db.insert(testAttempts).values({
        id: randomUUID(), userId: user.id, quizId: quiz.id,
        quizSnapshot: snapshotQuiz(quiz), questionsSnapshot: ordered.map(snapshotQuestion),
      }).returning();
      return Response.json(detail({ attempt, quiz: snapshotQuiz(quiz), ordered: ordered.map(snapshotQuestion) }));
    }
    const parsed = z.object({ action: z.enum(["save", "submit"]), attemptId: z.string().min(1).max(120), answers: z.unknown().optional(), reviewIds: z.unknown().optional() }).safeParse(input);
    if (!parsed.success) throw new ApiError(400, "Invalid attempt request.");
    if (parsed.data.action === "submit") return Response.json(await submit(parsed.data.attemptId, user.id, parsed.data.answers, parsed.data.reviewIds));
    const bundle = await ownedAttempt(parsed.data.attemptId, user.id);
    if (bundle.attempt.status !== "in_progress") return Response.json(detail(bundle));
    if (Date.now() > bundle.attempt.startedAt.getTime() + bundle.quiz.durationSeconds * 1000 + 10_000) return Response.json(await submit(bundle.attempt.id, user.id));
    const answers = validateAnswers(parsed.data.answers ?? {}, bundle.ordered);
    const reviewIds = validateReview(parsed.data.reviewIds ?? [], bundle.ordered);
    const [updated] = await db.update(testAttempts).set({ answers, reviewIds, updatedAt: new Date() }).where(and(eq(testAttempts.id, bundle.attempt.id), eq(testAttempts.status, "in_progress"))).returning();
    return Response.json({ ok: true, status: updated?.status || "submitted", updatedAt: updated?.updatedAt });
  } catch (error) { return jsonError(error); }
}
