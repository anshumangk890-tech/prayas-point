import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import "dotenv/config";
import { hash } from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import { pgTable, text, boolean } from "drizzle-orm/pg-core";
import { Pool } from "pg";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
const adminAccounts = pgTable("admin_accounts", {
  id: text("id").primaryKey(), email: text("email"), displayName: text("display_name"), passwordHash: text("password_hash"),
});
const sessions = pgTable("sessions", { tokenHash: text("token_hash").primaryKey(), principalId: text("principal_id") });
const auditLogs = pgTable("audit_logs", { id: text("id").primaryKey(), adminId: text("admin_id") });
const testUsers = pgTable("users", { id: text("id").primaryKey(), isDemo: boolean("is_demo") });
const testAttempts = pgTable("test_attempts", { id: text("id").primaryKey(), quizId: text("quiz_id") });
const testQuizzes = pgTable("quizzes", { id: text("id").primaryKey() });
const testQuestions = pgTable("questions", { id: text("id").primaryKey() });
const createdUsers = [];
const adminId = randomUUID();
const email = `phase-qa-${Date.now()}@example.test`;
const password = randomBytes(32).toString("base64url");
let questionId = "";
let quizId = "";
let adminCreated = false;
let checks = 0;

function pass(message) { checks += 1; console.log(`✓ ${message}`); }
async function request(path, { cookie, method = "GET", body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  const sessionCookie = response.headers.getSetCookie().find((header) => header.startsWith("exam_session=") && header.includes("HttpOnly"))?.split(";")[0] || "";
  return { status: response.status, payload, sessionCookie };
}
async function loginDemo() {
  const response = await request("/api/auth", { method: "POST", body: { action: "demo" } });
  assert.equal(response.status, 200, JSON.stringify(response.payload));
  assert.equal(response.payload.data.user.isDemo, true);
  assert.equal(response.payload.data.user.verifiedPhone, false);
  createdUsers.push(response.payload.data.user.id);
  return response.sessionCookie;
}
function adminBody(resource, action, data, id) { return { resource, action, data, ...(id ? { id } : {}) }; }

try {
  const health = await request("/api/health");
  assert.equal(health.payload.ok, true);
  const guest = await request("/api/bootstrap");
  assert.equal(guest.status, 200);
  assert.equal(guest.payload.authenticated, false);
  const fake = await request("/api/auth", { method: "POST", body: { action: "firebase", idToken: "not-a-real-firebase-token-".repeat(5) } });
  assert.equal(fake.status, guest.payload.firebaseConfigured ? 401 : 503);
  assert.equal((await request("/api/attempts?id=unknown")).status, 401);
  pass("database is healthy; fake Firebase tokens never establish a session");

  const cookie = await loginDemo();
  assert.equal((await request("/api/admin", { cookie })).status, 403);
  const invalidState = await request("/api/profile", { method: "PATCH", cookie, body: { name: "Phase Tester", email: "phase@example.test", state: "Invalid State", goalExamId: "railway-group-d", preferredLanguage: "hi", notificationsEnabled: true } });
  assert.equal(invalidState.status, 400);
  const unavailableGoal = await request("/api/profile", { method: "POST", cookie, body: { action: "selectGoal", goalExamId: "ssc-mts" } });
  assert.equal(unavailableGoal.status, 400);
  const profile = await request("/api/profile", { method: "PATCH", cookie, body: { name: "Phase Tester", email: "phase@example.test", state: "Bihar", goalExamId: "railway-group-d", preferredLanguage: "hi", notificationsEnabled: true } });
  assert.equal(profile.status, 200);
  const afterProfile = await request("/api/bootstrap", { cookie });
  assert.equal(afterProfile.payload.data.user.name, "Phase Tester");
  assert.equal(afterProfile.payload.data.user.state, "Bihar");
  assert.equal(afterProfile.payload.data.user.goalExamId, "railway-group-d");
  pass("profile changes persist and unfinished exams remain locked");

  await db.insert(adminAccounts).values({ id: adminId, email, displayName: "Temporary test administrator", passwordHash: await hash(password, 12) });
  adminCreated = true;
  const adminLogin = await request("/api/auth", { method: "POST", body: { action: "admin", email, password } });
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.payload));
  const adminCookie = adminLogin.sessionCookie;
  const questionValue = {
    examId: "railway-group-d", subjectId: "maths", topicId: "percentages",
    questionText: "QA original practice: What is 2 + 2?", options: [{ id: "A", text: "4" }, { id: "B", text: "5" }],
    correctAnswers: ["A"], questionType: "single", explanation: "Original answer: two plus two is four.",
    difficulty: "easy", language: "en", sourceType: "original-practice", sourceYear: null, isPublished: true,
  };
  const question = await request("/api/admin", { method: "POST", cookie: adminCookie, body: adminBody("questions", "create", questionValue) });
  assert.equal(question.status, 200, JSON.stringify(question.payload));
  questionId = question.payload.record.id;
  const quizValue = {
    title: "Temporary original practice QA", description: "Private automated test content", examId: "railway-group-d", kind: "daily",
    questionIds: [questionId], durationSeconds: 180, scoringConfig: { correct: 2, incorrect: -0.5, unanswered: 0 }, isPublished: true,
  };
  const quiz = await request("/api/admin", { method: "POST", cookie: adminCookie, body: adminBody("quizzes", "create", quizValue) });
  assert.equal(quiz.status, 200, JSON.stringify(quiz.payload));
  quizId = quiz.payload.record.id;
  const start = await request("/api/attempts", { method: "POST", cookie, body: { action: "start", quizId } });
  assert.equal(start.status, 200, JSON.stringify(start.payload));
  const attemptId = start.payload.attempt.id;
  assert.deepEqual(start.payload.questions.map((item) => item.id), [questionId]);
  assert.equal(start.payload.quiz.scoringConfig.correct, 2);
  assert.equal(start.payload.attempt.questionsSnapshot, undefined);
  assert.equal(start.payload.attempt.quizSnapshot, undefined);
  assert.equal(start.payload.questions[0].correctAnswers, undefined);
  const bootstrapDuringAttempt = await request("/api/bootstrap", { cookie });
  assert.equal(bootstrapDuringAttempt.payload.data.attempts.find((row) => row.id === attemptId)?.questionsSnapshot, undefined);
  assert.equal(bootstrapDuringAttempt.payload.data.attempts.find((row) => row.id === attemptId)?.quizSnapshot, undefined);
  pass("admin-published database question loads without exposing answer keys or private snapshots");

  const wrongOwnerCookie = await loginDemo();
  const crossUser = await request(`/api/attempts?id=${attemptId}`, { cookie: wrongOwnerCookie });
  assert.equal(crossUser.status, 404);
  assert.equal((await request("/api/admin", { cookie: wrongOwnerCookie })).status, 403);
  const loggedOut = await request("/api/auth", { method: "POST", cookie: wrongOwnerCookie, body: { action: "logout" } });
  assert.equal(loggedOut.status, 200);
  assert.equal((await request("/api/bootstrap", { cookie: wrongOwnerCookie })).payload.authenticated, false);
  pass("another student cannot read attempts or admin records; logout revokes its server session");

  const saved = await request("/api/attempts", { method: "POST", cookie, body: { action: "save", attemptId, answers: { [questionId]: ["A"] }, reviewIds: [questionId] } });
  assert.equal(saved.status, 200);
  const editedQuestion = await request("/api/admin", { method: "POST", cookie: adminCookie, body: adminBody("questions", "update", { ...questionValue, correctAnswers: ["B"], explanation: "New answer after publication." }, questionId) });
  assert.equal(editedQuestion.status, 200, JSON.stringify(editedQuestion.payload));
  const editedQuiz = await request("/api/admin", { method: "POST", cookie: adminCookie, body: adminBody("quizzes", "update", { ...quizValue, durationSeconds: 60, scoringConfig: { correct: 10, incorrect: -1, unanswered: 0 } }, quizId) });
  assert.equal(editedQuiz.status, 200, JSON.stringify(editedQuiz.payload));
  const submitted = await request("/api/attempts", { method: "POST", cookie, body: { action: "submit", attemptId, answers: { [questionId]: ["A"] }, reviewIds: [questionId] } });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.payload));
  assert.equal(submitted.payload.attempt.status, "submitted");
  assert.equal(submitted.payload.attempt.score, 2);
  assert.equal(submitted.payload.quiz.durationSeconds, 180);
  assert.deepEqual(submitted.payload.review[0].correctAnswers, ["A"]);
  assert.equal(submitted.payload.review[0].isCorrect, true);
  assert.equal(submitted.payload.review[0].explanation, questionValue.explanation);
  const persisted = await request(`/api/attempts?id=${attemptId}`, { cookie });
  assert.equal(persisted.payload.attempt.score, 2);
  assert.deepEqual(persisted.payload.review[0].correctAnswers, ["A"]);
  const duplicate = await request("/api/attempts", { method: "POST", cookie, body: { action: "submit", attemptId, answers: {}, reviewIds: [] } });
  assert.equal(duplicate.payload.attempt.score, 2);
  const progress = await request("/api/bootstrap", { cookie });
  assert.equal(progress.payload.data.subjectPerformance.maths.correct, 1);
  pass("server scoring and saved explanations remain stable after admin content edits");

  const retry = await request("/api/attempts", { method: "POST", cookie, body: { action: "start", quizId, retry: true } });
  assert.equal(retry.status, 200);
  assert.equal(retry.payload.quiz.scoringConfig.correct, 10);
  const secondResult = await request("/api/attempts", { method: "POST", cookie, body: { action: "submit", attemptId: retry.payload.attempt.id, answers: { [questionId]: ["B"] }, reviewIds: [] } });
  assert.equal(secondResult.payload.attempt.score, 10);
  assert.deepEqual(secondResult.payload.review[0].correctAnswers, ["B"]);
  pass("retry uses the current published rules and stores a distinct result");
  console.log(`PASS: ${checks} backend phase checks completed`);
} finally {
  // All cleanup uses Drizzle; only records created by this script are removed.
  try {
    if (createdUsers.length) {
      await db.delete(sessions).where(inArray(sessions.principalId, createdUsers));
      await db.delete(testUsers).where(inArray(testUsers.id, createdUsers));
    }
    if (quizId) {
      await db.delete(testAttempts).where(eq(testAttempts.quizId, quizId));
      await db.delete(testQuizzes).where(eq(testQuizzes.id, quizId));
    }
    if (questionId) await db.delete(testQuestions).where(eq(testQuestions.id, questionId));
    if (adminCreated) {
      await db.delete(sessions).where(eq(sessions.principalId, adminId));
      await db.delete(auditLogs).where(eq(auditLogs.adminId, adminId));
      await db.delete(adminAccounts).where(eq(adminAccounts.id, adminId));
    }
  } catch (error) { console.error("Temporary test-record cleanup failed:", error); }
  await pool.end();
}
