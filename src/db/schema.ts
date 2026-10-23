import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type QuestionOption = { id: string; text: string };
export type ScoringConfig = { correct: number; incorrect: number; unanswered: number };
export type AnswerMap = Record<string, string[]>;

// These snapshots never leave the server until the owning student has submitted.
// Keeping them with each attempt prevents later admin edits from changing a result.
export type AttemptQuestionSnapshot = {
  id: string; subjectId: string; topicId: string | null; questionText: string;
  options: QuestionOption[]; correctAnswers: string[]; questionType: string;
  explanation: string; language: string; sourceType: string;
};
export type AttemptQuizSnapshot = {
  id: string; title: string; description: string; examId: string; kind: string;
  questionIds: string[]; durationSeconds: number; scoringConfig: ScoringConfig;
  isPublished: boolean; availableFrom: string | null; availableUntil: string | null;
};

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Firebase UID, or an isolated demo UID.
  name: text("name").default("").notNull(),
  phoneNumber: text("phone_number"),
  verifiedPhone: boolean("verified_phone").default(false).notNull(),
  email: text("email").default("").notNull(),
  state: text("state").default("").notNull(),
  goalExamId: text("goal_exam_id").default("railway-group-d").notNull(),
  preferredLanguage: text("preferred_language").default("hi").notNull(),
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  registrationCompleted: boolean("registration_completed").default(false).notNull(),
  privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }),
  isDemo: boolean("is_demo").default(false).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const adminAccounts = pgTable("admin_accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex("admin_email_unique").on(table.email)]);

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  principalId: text("principal_id").notNull(),
  role: text("role").notNull(), // student | admin
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [index("sessions_principal_idx").on(table.principalId), index("sessions_expiry_idx").on(table.expiresAt)]);

export const authRateLimits = pgTable("auth_rate_limits", {
  id: text("id").primaryKey(),
  ipHash: text("ip_hash").notNull(),
  kind: text("kind").notNull(),
  createdAt: createdAt(),
}, (table) => [index("auth_rate_limits_lookup_idx").on(table.ipHash, table.kind, table.createdAt)]);

export const examCategories = pgTable("exam_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  groupName: text("group_name").notNull(),
  description: text("description").default("").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull().references(() => examCategories.id),
  name: text("name").notNull(),
  nameHi: text("name_hi").default("").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [index("subjects_exam_idx").on(table.examId)]);

export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull().references(() => subjects.id),
  name: text("name").notNull(),
  nameHi: text("name_hi").default("").notNull(),
  description: text("description").default("").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: updatedAt(),
}, (table) => [index("topics_subject_idx").on(table.subjectId)]);

export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull().references(() => examCategories.id),
  subjectId: text("subject_id").notNull().references(() => subjects.id),
  topicId: text("topic_id").references(() => topics.id),
  questionText: text("question_text").notNull(),
  options: jsonb("options").$type<QuestionOption[]>().notNull(),
  correctAnswers: jsonb("correct_answers").$type<string[]>().notNull(),
  questionType: text("question_type").default("single").notNull(),
  explanation: text("explanation").default("").notNull(),
  difficulty: text("difficulty").default("easy").notNull(),
  language: text("language").default("en").notNull(),
  sourceType: text("source_type").default("practice").notNull(),
  sourceYear: integer("source_year"),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("questions_exam_published_idx").on(table.examId, table.isPublished)]);

export const quizzes = pgTable("quizzes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").default("").notNull(),
  examId: text("exam_id").notNull().references(() => examCategories.id),
  kind: text("kind").default("daily").notNull(), // daily | mock | practice
  questionIds: jsonb("question_ids").$type<string[]>().notNull(),
  durationSeconds: integer("duration_seconds").default(600).notNull(),
  scoringConfig: jsonb("scoring_config").$type<ScoringConfig>().notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  availableFrom: timestamp("available_from", { withTimezone: true }),
  availableUntil: timestamp("available_until", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("quizzes_exam_published_idx").on(table.examId, table.isPublished)]);

export const testAttempts = pgTable("test_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quizId: text("quiz_id").notNull().references(() => quizzes.id),
  answers: jsonb("answers").$type<AnswerMap>().default({}).notNull(),
  reviewIds: jsonb("review_ids").$type<string[]>().default([]).notNull(),
  // Private answer keys and marking rules. API responses must explicitly omit these.
  questionsSnapshot: jsonb("questions_snapshot").$type<AttemptQuestionSnapshot[]>(),
  quizSnapshot: jsonb("quiz_snapshot").$type<AttemptQuizSnapshot>(),
  startedAt: createdAt(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  score: real("score"),
  accuracy: real("accuracy"),
  timeTakenSeconds: integer("time_taken_seconds"),
  status: text("status").default("in_progress").notNull(),
  updatedAt: updatedAt(),
}, (table) => [index("attempts_user_idx").on(table.userId, table.startedAt)]);

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").default("").notNull(),
  examId: text("exam_id").notNull().references(() => examCategories.id),
  subjectId: text("subject_id").references(() => subjects.id),
  topicId: text("topic_id").references(() => topics.id),
  documentType: text("document_type").default("note").notNull(), // note | pdf | paper
  body: text("body").default("").notNull(),
  language: text("language").default("en").notNull(),
  year: integer("year"),
  sourceLabel: text("source_label").default("").notNull(),
  downloadAllowed: boolean("download_allowed").default(false).notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("documents_exam_published_idx").on(table.examId, table.isPublished)]);

export const documentFiles = pgTable("document_files", {
  documentId: text("document_id").primaryKey().references(() => documents.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  base64Data: text("base64_data").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
});

export const banners = pgTable("banners", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").default("").notNull(),
  imageUrl: text("image_url").default("").notNull(),
  destinationType: text("destination_type").default("syllabus").notNull(),
  destinationId: text("destination_id").default("").notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetAudience: text("target_audience").default("all").notNull(),
  destinationType: text("destination_type").default("").notNull(),
  destinationId: text("destination_id").default("").notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: createdAt(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const notificationReads = pgTable("notification_reads", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  notificationId: text("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
  readAt: createdAt(),
}, (table) => [primaryKey({ columns: [table.userId, table.notificationId] })]);

export const bookmarks = pgTable("bookmarks", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(), // topic | document | question
  itemId: text("item_id").notNull(),
  createdAt: createdAt(),
}, (table) => [primaryKey({ columns: [table.userId, table.itemType, table.itemId] })]);

export const topicProgress = pgTable("topic_progress", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  completedAt: createdAt(),
}, (table) => [primaryKey({ columns: [table.userId, table.topicId] })]);

export const documentOpens = pgTable("document_opens", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.documentId] })]);

export const jobAlerts = pgTable("job_alerts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  sourceUrl: text("source_url").default("").notNull(),
  sourceLabel: text("source_label").default("").notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});

export const pushTokens = pgTable("push_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  updatedAt: updatedAt(),
}, (table) => [index("push_tokens_user_idx").on(table.userId)]);

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id").notNull(),
  detail: text("detail").default("").notNull(),
  createdAt: createdAt(),
}, (table) => [index("audit_logs_created_idx").on(table.createdAt)]);
