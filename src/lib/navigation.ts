import type { Screen } from "@/lib/types";

// Other categories may be prepared in the dashboard, but their student modules
// must remain locked until they actually exist in this client.
export const ACTIVE_EXAM_ID = "railway-group-d";
export function isExamReady(exam: { id: string; isActive: boolean }) {
  return exam.id === ACTIVE_EXAM_ID && exam.isActive;
}

export function destinationScreen(type: string, id?: string): Screen | null {
  if (type === "documents") return id ? { name: "document-detail", id } : { name: "library" };
  if (["home", "syllabus", "quizzes", "tests", "library", "progress", "job-alerts", "papers"].includes(type)) {
    return { name: type };
  }
  return null;
}

export function screenHash(screen: Screen) {
  return `#${screen.name}${screen.id ? `/${encodeURIComponent(screen.id)}` : ""}`;
}

export function isSecondBackPress(lastPress: number, now: number) {
  return lastPress > 0 && now >= lastPress && now - lastPress < 2000;
}

export function historyStack(state: unknown): Screen[] | null {
  if (!state || typeof state !== "object" || !("examApp" in state) || !(state as { examApp?: boolean }).examApp) return null;
  const stack = (state as { stack?: unknown }).stack;
  if (!Array.isArray(stack) || stack.length < 1 || stack.length > 100 || stack[0]?.name !== "home") return null;
  if (!stack.every((item) => item && typeof item.name === "string" && item.name.length < 80 && (!item.id || typeof item.id === "string"))) return null;
  return stack as Screen[];
}
