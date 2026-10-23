"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Bookmark, Check, CheckCircle2, ChevronDown, ChevronUp, CircleHelp, Clock3, Flag, LoaderCircle, RotateCcw, ShieldCheck, Target, Timer, Trophy, X } from "lucide-react";
import { apiRequest, postJson } from "@/lib/client-api";
import { formatDateTime, formatTime } from "@/lib/types";
import type { AppData, AttemptDetail, Screen } from "@/lib/types";
import { EmptyState, ProgressBar, StatusBadge } from "@/components/Shared";

export type QuizProps = {
  screen: Screen; data: AppData; language: string; navigate: (screen: Screen) => void; goBack: () => void;
  toast: (message: string) => void; askConfirm: (title: string, description: string, action: () => void) => void;
  registerBackPriority: (handler: (() => boolean) | null) => void;
  refresh: () => Promise<void>; toggleBookmark: (type: "question", id: string) => void;
};

export function QuizExperience(props: QuizProps) {
  if (props.screen.name === "quiz-instructions") return <Instructions {...props} />;
  if (props.screen.name === "attempt") return <Attempt {...props} />;
  return <Result {...props} />;
}

function Instructions({ screen, data, navigate, goBack, toast, refresh }: QuizProps) {
  const quiz = data.quizzes.find((item) => item.id === screen.id);
  const [busy, setBusy] = useState(false);
  if (!quiz) return <EmptyState title="Test unavailable" description="This test may have been unpublished. Choose another practice set." action={{ label: "Back to tests", onClick: goBack }} />;
  const active = data.attempts.find((item) => item.quizId === quiz.id && item.status === "in_progress");
  const start = async () => {
    setBusy(true);
    try {
      const result = await postJson<AttemptDetail>("/api/attempts", { action: "start", quizId: quiz.id });
      await refresh().catch(() => { toast("The test started, but the list could not refresh. Your attempt is still saved."); });
      navigate({ name: "attempt", id: result.attempt.id });
    } catch (error) { toast((error as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="page-stack">
    <button className="back-link" onClick={goBack}><ArrowLeft size={17} /> Back</button>
    <div className="instructions-hero"><div className="instructions-icon">{quiz.kind === "mock" ? <Trophy size={28} /> : <CircleHelp size={28} />}</div>
      <div><span className="eyebrow">RAILWAY GROUP D · {quiz.kind === "mock" ? "MINI MOCK" : "PRACTICE"}</span><h1>{quiz.title}</h1><p>{quiz.description}</p></div></div>
    <div className="instruction-stats"><div><CircleHelp size={20} /><strong>{quiz.questionIds.length}</strong><span>Questions</span></div><div><Clock3 size={20} /><strong>{Math.ceil(quiz.durationSeconds / 60)} min</strong><span>Time limit</span></div><div><Target size={20} /><strong>{quiz.scoringConfig.correct > 0 ? `+${quiz.scoringConfig.correct}` : quiz.scoringConfig.correct}</strong><span>Correct answer</span></div></div>
    <section className="surface instruction-card"><h2>Before you begin</h2><div className="instruction-list">
      <p><CheckCircle2 size={18} /> Your answers are saved as you go. You can resume an unfinished test.</p>
      <p><CheckCircle2 size={18} /> Use the question palette to jump between questions and mark any for review.</p>
      <p><CheckCircle2 size={18} /> The timer continues if you leave this screen or close the browser.</p>
      <p><CheckCircle2 size={18} /> Scoring: +{quiz.scoringConfig.correct} correct · {quiz.scoringConfig.incorrect} incorrect · {quiz.scoringConfig.unanswered} skipped.</p>
    </div><div className="notice-strip"><ShieldCheck size={17} /> Original practice content. This is not an official previous-year paper.</div>
      <button className="primary-btn instruction-start" onClick={start} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}{busy ? "Preparing test..." : active ? "Resume saved test" : "Start test"}</button>
    </section>
  </div>;
}

function Attempt({ screen, data, navigate, goBack, toast, askConfirm, registerBackPriority, refresh }: QuizProps) {
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [syncState, setSyncState] = useState<"saved" | "saving" | "offline">("saved");
  const [submitting, setSubmitting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const currentAnswers = useRef(answers);
  const currentReview = useRef(reviewIds);
  const autoSubmitted = useRef(false);
  const pendingSave = useRef<{ answers: Record<string, string[]>; reviewIds: string[] } | null>(null);
  const saving = useRef(false);
  const draftKey = `exam-draft-${screen.id || ""}`;
  const keepDraft = useCallback((nextAnswers: Record<string, string[]>, nextReview: string[]) => {
    currentAnswers.current = nextAnswers;
    currentReview.current = nextReview;
    try { localStorage.setItem(draftKey, JSON.stringify({ answers: nextAnswers, reviewIds: nextReview, updatedAt: Date.now() })); }
    catch { /* Server autosave remains available if device storage is disabled. */ }
  }, [draftKey]);
  useEffect(() => { currentAnswers.current = answers; currentReview.current = reviewIds; }, [answers, reviewIds]);
  useEffect(() => {
    if (!paletteOpen) return;
    registerBackPriority(() => { setPaletteOpen(false); return true; });
    return () => registerBackPriority(null);
  }, [paletteOpen, registerBackPriority]);
  const load = useCallback(async () => {
    if (!screen.id) return;
    setLoadError("");
    try {
      const result = await apiRequest<AttemptDetail>(`/api/attempts?id=${encodeURIComponent(screen.id)}`);
      if (result.attempt.status === "submitted") { navigate({ name: "result", id: result.attempt.id }); return; }
      let draft: { answers: Record<string, string[]>; reviewIds: string[]; updatedAt: number } | null = null;
      try { draft = JSON.parse(localStorage.getItem(`exam-draft-${result.attempt.id}`) || "null"); } catch { /* Ignore a damaged local draft. */ }
      const restoredAnswers = draft?.answers && typeof draft.answers === "object" ? draft.answers : result.attempt.answers || {};
      const restoredReview = Array.isArray(draft?.reviewIds) ? draft.reviewIds : result.attempt.reviewIds || [];
      currentAnswers.current = restoredAnswers;
      currentReview.current = restoredReview;
      setAnswers(restoredAnswers);
      setReviewIds(restoredReview);
      setDetail(result);
      setRemaining(Math.max(0, Math.ceil((new Date(result.attempt.startedAt).getTime() + result.quiz.durationSeconds * 1000 - Date.now()) / 1000)));
    } catch (error) { setLoadError((error as Error).message); }
  }, [screen.id, navigate]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!detail || detail.attempt.status !== "in_progress") return;
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((new Date(detail.attempt.startedAt).getTime() + detail.quiz.durationSeconds * 1000 - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [detail]);
  const flushPending = useCallback(async () => {
    if (!detail || saving.current) return;
    saving.current = true;
    try {
      while (pendingSave.current) {
        const snapshot = pendingSave.current;
        pendingSave.current = null;
        setSyncState("saving");
        try {
          const response = await postJson<{ status: string }>("/api/attempts", {
            action: "save", attemptId: detail.attempt.id, answers: snapshot.answers, reviewIds: snapshot.reviewIds,
          });
          if (response.status === "submitted") {
            localStorage.removeItem(draftKey);
            navigate({ name: "result", id: detail.attempt.id });
            return;
          }
          if (!pendingSave.current && snapshot.answers === currentAnswers.current && snapshot.reviewIds === currentReview.current) {
            localStorage.removeItem(draftKey);
            setSyncState("saved");
          }
        } catch {
          pendingSave.current ||= snapshot;
          setSyncState("offline");
          return;
        }
      }
    } finally { saving.current = false; }
  }, [detail, draftKey, navigate]);
  const saveDraft = useCallback((nextAnswers: Record<string, string[]>, nextReview: string[]) => {
    if (!detail) return;
    keepDraft(nextAnswers, nextReview);
    pendingSave.current = { answers: nextAnswers, reviewIds: nextReview };
    void flushPending();
  }, [detail, flushPending, keepDraft]);
  useEffect(() => {
    if (!detail) return;
    const timer = window.setTimeout(() => { saveDraft(answers, reviewIds); }, 500);
    return () => window.clearTimeout(timer);
  }, [answers, reviewIds, detail, saveDraft]);
  useEffect(() => {
    const sync = () => { if (syncState === "offline") saveDraft(currentAnswers.current, currentReview.current); };
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [saveDraft, syncState]);
  const submit = useCallback(async () => {
    if (!detail || submitting) return;
    setSubmitting(true);
    try {
      const result = await postJson<AttemptDetail>("/api/attempts", { action: "submit", attemptId: detail.attempt.id, answers: currentAnswers.current, reviewIds: currentReview.current });
      if (result.attempt.status !== "submitted") throw new Error("The test could not be confirmed. Please retry submission.");
      localStorage.removeItem(`exam-draft-${detail.attempt.id}`);
      await refresh().catch(() => { toast("Your result was saved, but the dashboard could not refresh. Reconnect to see updated progress."); });
      navigate({ name: "result", id: detail.attempt.id });
    } catch (error) { toast((error as Error).message); autoSubmitted.current = false; }
    finally { setSubmitting(false); }
  }, [detail, submitting, refresh, navigate, toast]);
  useEffect(() => { if (detail && remaining === 0 && !autoSubmitted.current) { autoSubmitted.current = true; void submit(); } }, [remaining, detail, submit]);
  if (loadError) return <div className="page-stack"><EmptyState icon={<AlertCircle />} title="Could not load your test" description={loadError} action={{ label: "Try again", onClick: () => void load() }} /></div>;
  if (!detail) return <div className="content-loading"><LoaderCircle className="spin" /> Loading your saved test...</div>;
  const question = detail.questions[index];
  if (!question) return <EmptyState title="No questions available" description="This test is being updated. Please contact support." action={{ label: "Go back", onClick: goBack }} />;
  const selected = answers[question.id] || [];
  const answeredCount = detail.questions.filter((item) => (answers[item.id] || []).length > 0).length;
  const choose = (optionId: string) => {
    if (remaining === 0) return;
    const existing = currentAnswers.current[question.id] || [];
    const selectedOptions = question.questionType === "multiple"
      ? existing.includes(optionId) ? existing.filter((item) => item !== optionId) : [...existing, optionId]
      : [optionId];
    const nextAnswers = { ...currentAnswers.current, [question.id]: selectedOptions };
    keepDraft(nextAnswers, currentReview.current);
    setAnswers(nextAnswers);
  };
  const toggleReview = () => {
    const nextReview = currentReview.current.includes(question.id)
      ? currentReview.current.filter((item) => item !== question.id)
      : [...currentReview.current, question.id];
    keepDraft(currentAnswers.current, nextReview);
    setReviewIds(nextReview);
  };
  const clearResponse = () => {
    const nextAnswers = { ...currentAnswers.current, [question.id]: [] };
    keepDraft(nextAnswers, currentReview.current);
    setAnswers(nextAnswers);
  };
  return <div className="test-layout">
    <div className="test-main"><div className="test-topline"><button className="back-link" onClick={goBack}><ArrowLeft size={17} /> Leave test</button><div className={`timer-pill ${remaining < 60 ? "timer-urgent" : ""}`}><Timer size={17} />{formatTime(remaining)} left</div></div>
      <div className="test-heading"><div><span className="eyebrow">{detail.quiz.kind === "mock" ? "MOCK TEST" : "PRACTICE QUIZ"}</span><h1>{detail.quiz.title}</h1></div><button className="palette-mobile-btn" onClick={() => setPaletteOpen(!paletteOpen)}>Questions <span>{index + 1}/{detail.questions.length}</span></button></div>
      <div className="test-progress"><span>Question {index + 1} of {detail.questions.length}</span><span>{answeredCount} answered</span></div><ProgressBar value={(index + 1) / detail.questions.length * 100} />
      <section className="surface question-card"><div className="question-meta"><span className="question-number">Q{String(index + 1).padStart(2, "0")}</span><span>{data.subjects.find((item) => item.id === question.subjectId)?.name || "General"}</span><span className="question-type">{question.questionType === "multiple" ? "Select all that apply" : "Choose one answer"}</span></div>
        <h2>{question.questionText}</h2><div className="answer-options">{question.options.map((option) => <button key={option.id} className={`answer-option ${selected.includes(option.id) ? "selected" : ""}`} onClick={() => choose(option.id)} aria-pressed={selected.includes(option.id)}><span className="option-letter">{option.id}</span><span>{option.text}</span><span className="option-check">{selected.includes(option.id) && <Check size={15} />}</span></button>)}</div>
        <div className="question-actions"><button className={`subtle-action ${reviewIds.includes(question.id) ? "active-review" : ""}`} onClick={toggleReview}><Flag size={17} /> {reviewIds.includes(question.id) ? "Marked for review" : "Mark for review"}</button><button className="subtle-action" onClick={clearResponse}><X size={17} /> Clear response</button></div>
      </section>
      <div className="test-bottom"><button className="outline-btn" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft size={17} /> Previous</button><span className={`save-indicator ${syncState === "offline" ? "save-offline" : ""}`}>{syncState === "saved" ? <Check size={14} /> : syncState === "saving" ? <LoaderCircle className="spin" size={14} /> : <AlertCircle size={14} />}{syncState === "offline" ? "Saved on this device · reconnect to sync" : syncState === "saving" ? "Saving..." : "Answers saved"}</span>{index < detail.questions.length - 1 ? <button className="primary-btn" onClick={() => setIndex(index + 1)}>Save & next <ArrowRight size={17} /></button> : <button className="primary-btn" disabled={submitting} onClick={() => askConfirm("Submit your test?", `${answeredCount} answered · ${detail.questions.length - answeredCount} unanswered. You can review answers after submitting.`, () => void submit())}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Submit test</button>}</div>
    </div>
    <aside className={`test-palette surface ${paletteOpen ? "palette-open" : ""}`}><div className="palette-heading"><div><h3>Question palette</h3><p>Jump to any question</p></div><button className="palette-close" onClick={() => setPaletteOpen(false)} aria-label="Close question palette"><X size={19} /></button></div><div className="palette-grid">{detail.questions.map((item, i) => <button key={item.id} onClick={() => { setIndex(i); setPaletteOpen(false); }} className={`${i === index ? "current" : ""} ${reviewIds.includes(item.id) ? "reviewed" : (answers[item.id] || []).length ? "answered" : ""}`} aria-label={`Question ${i + 1}${(answers[item.id] || []).length ? ", answered" : ", unanswered"}`}>{i + 1}</button>)}</div><div className="palette-legend"><span><i className="legend-answered" /> Answered {answeredCount}</span><span><i className="legend-review" /> Review {reviewIds.length}</span><span><i className="legend-empty" /> Unanswered {detail.questions.length - answeredCount}</span></div><button className="palette-submit" disabled={submitting} onClick={() => askConfirm("Submit your test?", "You will not be able to change answers after submission.", () => void submit())}>Submit test <ArrowRight size={16} /></button></aside>
  </div>;
}

function Result({ screen, data, navigate, goBack, toast, toggleBookmark, refresh }: QuizProps) {
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (screen.id) apiRequest<AttemptDetail>(`/api/attempts?id=${encodeURIComponent(screen.id)}`).then((value) => { if (live) setDetail(value); }).catch((cause) => { if (live) setError((cause as Error).message); });
    return () => { live = false; };
  }, [screen.id]);
  if (error) return <EmptyState title="Result unavailable" description={error} action={{ label: "Go back", onClick: goBack }} />;
  if (!detail) return <div className="content-loading"><LoaderCircle className="spin" /> Loading your result...</div>;
  if (detail.attempt.status !== "submitted") return <EmptyState title="Test still in progress" description="Your answers are saved. Continue to finish the test." action={{ label: "Continue test", onClick: () => navigate({ name: "attempt", id: detail.attempt.id }) }} />;
  const review = detail.review || [];
  const correct = review.filter((item) => item.isCorrect).length;
  const incorrect = review.filter((item) => item.selectedAnswers.length > 0 && !item.isCorrect).length;
  const skipped = review.length - correct - incorrect;
  const retry = async () => {
    setBusy(true);
    try { const response = await postJson<AttemptDetail>("/api/attempts", { action: "start", quizId: detail.quiz.id, retry: true }); await refresh(); navigate({ name: "attempt", id: response.attempt.id }); }
    catch (cause) { toast((cause as Error).message); } finally { setBusy(false); }
  };
  return <div className="page-stack result-page"><button className="back-link" onClick={goBack}><ArrowLeft size={17} /> Back</button>
    <div className="result-hero"><div className="result-trophy"><Trophy size={31} /></div><span className="eyebrow">TEST COMPLETE</span><h1>Every attempt is progress.</h1><p>{detail.quiz.title} · {formatDateTime(detail.attempt.submittedAt)}</p><div className="result-score"><strong>{detail.attempt.score}</strong><span>points earned</span></div><span className="result-marking">Scoring: +{detail.quiz.scoringConfig.correct} / {detail.quiz.scoringConfig.incorrect} / {detail.quiz.scoringConfig.unanswered}</span></div>
    <div className="result-metrics"><div><CheckCircle2 size={19} /><strong>{correct}</strong><span>Correct</span></div><div><X size={19} /><strong>{incorrect}</strong><span>Incorrect</span></div><div><CircleHelp size={19} /><strong>{skipped}</strong><span>Skipped</span></div><div><Target size={19} /><strong>{detail.attempt.accuracy ?? 0}%</strong><span>Accuracy</span></div><div><Clock3 size={19} /><strong>{formatTime(detail.attempt.timeTakenSeconds ?? 0)}</strong><span>Time taken</span></div></div>
    <section className="surface subject-analysis"><div className="section-title"><div><span className="eyebrow">YOUR PERFORMANCE</span><h2>Subject-wise analysis</h2></div></div><div className="analysis-list">{detail.breakdown?.map((item) => <div key={item.subjectId} className="analysis-row"><div><strong>{data.subjects.find((subject) => subject.id === item.subjectId)?.name || item.subjectId}</strong><span>{item.correct} of {item.total} correct</span></div><ProgressBar value={item.total ? item.correct / item.total * 100 : 0} /><b>{Math.round(item.correct / item.total * 100)}%</b></div>)}</div></section>
    <section className="review-section"><div className="section-title"><div><span className="eyebrow">LEARN FROM EVERY ANSWER</span><h2>Answer review</h2></div><StatusBadge tone="neutral">{review.length} questions</StatusBadge></div>
      {review.map((item, index) => { const open = expanded === item.id; const saved = data.bookmarks.some((mark) => mark.itemType === "question" && mark.itemId === item.id); return <article key={item.id} className="review-item surface"><button className="review-toggle" onClick={() => setExpanded(open ? null : item.id)}><span className={`review-state ${item.isCorrect ? "correct" : item.selectedAnswers.length ? "incorrect" : "skipped"}`}>{item.isCorrect ? <Check size={15} /> : item.selectedAnswers.length ? <X size={15} /> : <CircleHelp size={15} />}</span><span><small>QUESTION {String(index + 1).padStart(2, "0")} · {item.sourceType === "original-practice" ? "Original practice" : "Licensed source"}</small><strong>{item.questionText}</strong></span>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>{open && <div className="review-body"><div className="review-options">{item.options.map((option) => <div key={option.id} className={`${item.correctAnswers.includes(option.id) ? "correct-option" : item.selectedAnswers.includes(option.id) ? "wrong-option" : ""}`}><b>{option.id}</b>{option.text}{item.correctAnswers.includes(option.id) && <Check size={16} />}</div>)}</div><div className="explanation"><strong>Explanation</strong><p>{item.explanation || "An explanation has not been added yet."}</p></div><button className={`subtle-action ${saved ? "active-review" : ""}`} onClick={() => toggleBookmark("question", item.id)}><Bookmark size={16} fill={saved ? "currentColor" : "none"} />{saved ? "Saved question" : "Save question"}</button></div>}</article>; })}
    </section><div className="result-actions"><button className="outline-btn" onClick={() => navigate({ name: "progress" })}>View progress <ArrowRight size={17} /></button><button className="primary-btn" onClick={retry} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <RotateCcw size={17} />} Try again</button></div>
  </div>;
}
