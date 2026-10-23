export type ExamCategory = { id: string; name: string; groupName: string; description: string; isActive: boolean; sortOrder: number };
export type Subject = { id: string; examId: string; name: string; nameHi: string; sortOrder: number; isActive: boolean };
export type Topic = { id: string; subjectId: string; name: string; nameHi: string; description: string; sortOrder: number; isActive: boolean; updatedAt?: string };
export type Quiz = { id: string; title: string; description: string; examId: string; kind: string; questionIds: string[]; durationSeconds: number; scoringConfig: { correct: number; incorrect: number; unanswered: number }; isPublished: boolean; availableFrom?: string | null; availableUntil?: string | null };
export type DocumentItem = { id: string; title: string; description: string; examId: string; subjectId: string | null; topicId: string | null; documentType: string; body: string; language: string; year: number | null; sourceLabel: string; downloadAllowed: boolean; isPublished: boolean; hasFile?: boolean; createdAt?: string };
export type Banner = { id: string; title: string; subtitle: string; imageUrl: string; destinationType: string; destinationId: string; isPublished: boolean; sortOrder: number };
export type Notice = { id: string; title: string; message: string; destinationType: string; destinationId: string; publishedAt: string | null; isRead: boolean };
export type JobAlert = { id: string; title: string; summary: string; sourceUrl: string; sourceLabel: string; publishedAt: string; isPublished: boolean };
export type UserProfile = { id: string; name: string; phoneNumber: string | null; verifiedPhone: boolean; email: string; state: string; goalExamId: string; preferredLanguage: string; notificationsEnabled: boolean; registrationCompleted: boolean; isDemo: boolean };
export type AttemptSummary = { id: string; quizId: string; status: string; score: number | null; accuracy: number | null; startedAt: string; submittedAt: string | null; timeTakenSeconds: number | null; answers?: Record<string, string[]>; reviewIds?: string[] };
export type Bookmark = { itemType: string; itemId: string };
export type AppData = {
  user: UserProfile;
  categories: ExamCategory[];
  subjects: Subject[];
  topics: Topic[];
  quizzes: Quiz[];
  documents: DocumentItem[];
  banners: Banner[];
  notifications: Notice[];
  alerts: JobAlert[];
  attempts: AttemptSummary[];
  bookmarks: Bookmark[];
  completedTopicIds: string[];
  recentDocumentIds: string[];
  subjectPerformance: Record<string, { correct: number; total: number; attempted: number }>;
  studyStreak: number;
  settings: Record<string, string>;
  pushConfigured: boolean;
};
export type PublicQuestion = { id: string; subjectId: string; topicId: string | null; questionText: string; options: { id: string; text: string }[]; questionType: string; language: string };
export type ReviewQuestion = PublicQuestion & { correctAnswers: string[]; explanation: string; selectedAnswers: string[]; isCorrect: boolean; sourceType: string };
export type AttemptDetail = { attempt: AttemptSummary; quiz: Quiz; questions: PublicQuestion[]; review?: ReviewQuestion[]; breakdown?: { subjectId: string; correct: number; total: number }[] };
export type Screen = { name: string; id?: string; title?: string };

export const INDIAN_STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];

export function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
export function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
export function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
