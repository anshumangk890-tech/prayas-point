import type { AttemptQuestionSnapshot, AttemptQuizSnapshot } from "@/db/schema";
import { questions, quizzes, testAttempts } from "@/db/schema";

export function snapshotQuestion(question: typeof questions.$inferSelect): AttemptQuestionSnapshot {
  return {
    id: question.id, subjectId: question.subjectId, topicId: question.topicId,
    questionText: question.questionText, options: question.options,
    correctAnswers: question.correctAnswers, questionType: question.questionType,
    explanation: question.explanation, language: question.language, sourceType: question.sourceType,
  };
}

export function snapshotQuiz(quiz: typeof quizzes.$inferSelect): AttemptQuizSnapshot {
  return {
    id: quiz.id, title: quiz.title, description: quiz.description, examId: quiz.examId,
    kind: quiz.kind, questionIds: [...quiz.questionIds], durationSeconds: quiz.durationSeconds,
    scoringConfig: { ...quiz.scoringConfig }, isPublished: quiz.isPublished,
    availableFrom: quiz.availableFrom?.toISOString() || null,
    availableUntil: quiz.availableUntil?.toISOString() || null,
  };
}

export function publicAttempt(attempt: typeof testAttempts.$inferSelect) {
  return {
    id: attempt.id, quizId: attempt.quizId, answers: attempt.answers,
    reviewIds: attempt.reviewIds, startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt, score: attempt.score, accuracy: attempt.accuracy,
    timeTakenSeconds: attempt.timeTakenSeconds, status: attempt.status,
    updatedAt: attempt.updatedAt,
  };
}
