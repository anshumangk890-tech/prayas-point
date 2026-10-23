"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, Check, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/Shared";
import { apiRequest, postJson } from "@/lib/client-api";
import { APP_NAME, APP_SUBTITLE_HI } from "@/lib/branding";
import { isExamReady } from "@/lib/navigation";
import { INDIAN_STATES } from "@/lib/types";
import type { AppData } from "@/lib/types";

export function WelcomeScreen({ branding, onOpen }: {
  branding: Record<string, string>;
  onOpen: (data: AppData) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const appName = branding.appName || APP_NAME;
  const subtitle = branding.appSubtitle || APP_SUBTITLE_HI;

  const openStudy = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // An anonymous, owner-scoped PostgreSQL study session. No OTP is claimed.
      const response = await postJson<{ data: AppData }>("/api/auth", { action: "guest" });
      if (!response.data?.user?.registrationCompleted) throw new Error("Your study space could not be opened. Please try again.");
      onOpen(response.data);
    } catch (cause) {
      setError((cause as Error).message || "Could not open your study space. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="auth-layout welcome-layout">
    <div className="auth-story">
      <div className="auth-story-inner">
        <Brand name={appName} subtitle={subtitle} logoUrl={branding.logoUrl} light />
        <div className="auth-story-copy">
          <span className="auth-eyebrow"><Sparkles size={15} /> YOUR PREPARATION PARTNER</span>
          <h1>एक कदम आगे.<br /><span>Every single day.</span></h1>
          <p>A calm place to prepare for Railway Group D — learn the syllabus, practise with purpose, and see your progress grow.</p>
          <div className="auth-benefits">
            <span><Check size={17} /> Simple daily practice</span>
            <span><Check size={17} /> Progress that is really yours</span>
            <span><Check size={17} /> No ads or payment prompts</span>
          </div>
        </div>
        <div className="auth-illustration"><img src="/images/railway-study-banner.png" alt="Illustration of a train and study books" /></div>
        <div className="auth-story-footer">MADE FOR THE WAY YOU LEARN <span>●</span> HINDI + ENGLISH</div>
      </div>
    </div>
    <main className="auth-form-area welcome-area">
      <div className="auth-mobile-brand"><Brand name={appName} subtitle={subtitle} logoUrl={branding.logoUrl} small /></div>
      <div className="auth-form-wrap welcome-content">
        <span className="eyebrow">WELCOME TO PRAYAS POINT</span>
        <h2>Your preparation<br />starts here.</h2>
        <p className="auth-intro">One focused place for the Railway Group D syllabus, daily practice quizzes, study notes, mock tests and your own progress.</p>
        <button className="primary-btn welcome-primary" type="button" onClick={openStudy} disabled={busy} aria-busy={busy}>
          {busy ? <LoaderCircle className="spin" size={20} aria-hidden="true" /> : <BookOpen size={20} strokeWidth={2} aria-hidden="true" />}
          <span>{busy ? "Opening study space..." : "Open for Study"}</span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        {error && <div className="form-error" role="alert">{error}</div>}
        <p className="welcome-session-note"><ShieldCheck size={17} aria-hidden="true" /> Study as a guest. Progress stays with this browser session; signing out ends access to it.</p>
        <div className="auth-links">Read our <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</div>
        <div className="auth-admin-link"><Link href="/admin">Administrator sign in <ArrowRight size={14} /></Link></div>
      </div>
    </main>
  </div>;
}

// Existing verified-account registration stays available for users with an
// unfinished Firebase-backed profile. Guest study access skips this form.
export function RegistrationScreen({ data, onComplete, toast }: {
  data: AppData;
  onComplete: (data: AppData) => void;
  toast: (message: string) => void;
}) {
  const [name, setName] = useState(data.user.name);
  const [email, setEmail] = useState(data.user.email);
  const [state, setState] = useState(data.user.state);
  const [goalExamId, setGoalExamId] = useState("railway-group-d");
  const [language, setLanguage] = useState<"hi" | "en">(data.user.preferredLanguage === "en" ? "en" : "hi");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (name.trim().length < 2) { setError("Please enter your full name."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Please enter a valid email address."); return; }
    if (!state) { setError("Please select your state."); return; }
    if (!consent) { setError("Please accept the privacy policy to continue."); return; }
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/profile", { method: "PATCH", body: JSON.stringify({
        name: name.trim(), email: email.trim(), state, goalExamId,
        preferredLanguage: language, notificationsEnabled: true,
        completeRegistration: true, consent,
      }) });
      const response = await apiRequest<{ data: AppData }>("/api/bootstrap");
      if (!response.data?.user?.registrationCompleted) throw new Error("Your profile could not be confirmed. Please retry.");
      onComplete(response.data);
      toast("Your profile is ready. Let’s begin!");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  return <div className="registration-layout">
    <div className="registration-aside">
      <Brand name={data.settings.appName || APP_NAME} subtitle={data.settings.appSubtitle || APP_SUBTITLE_HI} logoUrl={data.settings.logoUrl} light />
      <div>
        <span className="eyebrow">WELCOME ABOARD</span>
        <h1>Your journey<br />starts here.</h1>
        <p>A few details help us make this learning space yours.</p>
        <div className="registration-steps">
          <span className="done">1 <Check size={15} /> Verify number</span>
          <span className="current">2 <ArrowRight size={15} /> Set up profile</span>
          <span>3 <BookOpen size={15} /> Start learning</span>
        </div>
      </div>
      <small>बड़ी तैयारी, छोटे कदम।</small>
    </div>
    <main className="registration-main"><div className="registration-card">
      <span className="eyebrow">STEP 2 OF 2</span>
      <h2>Tell us about yourself</h2>
      <p>Choose your goal and we’ll save your progress along the way.</p>
      <div className="form-grid">
        <div className="field"><label htmlFor="reg-name">Full name <span>*</span></label><input id="reg-name" value={name} placeholder="Enter your full name" onChange={(event) => setName(event.target.value)} maxLength={80} /></div>
        <div className="field"><label htmlFor="reg-mobile">Verified mobile number</label><div className="verified-field"><input id="reg-mobile" value={data.user.phoneNumber || ""} readOnly /><BadgeCheck size={18} /></div></div>
        <div className="field"><label htmlFor="reg-email">Email address <span>*</span></label><input id="reg-email" type="email" value={email} placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} maxLength={254} /></div>
        <div className="field"><label htmlFor="reg-state">Select your state <span>*</span></label><select id="reg-state" value={state} onChange={(event) => setState(event.target.value)}><option value="">Choose a state</option>{INDIAN_STATES.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="field"><label htmlFor="reg-goal">Your exam goal <span>*</span></label><select id="reg-goal" value={goalExamId} onChange={(event) => setGoalExamId(event.target.value)}>{data.categories.map((exam) => <option key={exam.id} value={exam.id} disabled={!isExamReady(exam)}>{exam.name} {isExamReady(exam) ? "— Active" : "— Coming soon"}</option>)}</select></div>
        <div className="field"><label htmlFor="reg-language">Preferred language</label><select id="reg-language" value={language} onChange={(event) => setLanguage(event.target.value as "hi" | "en")}><option value="hi">हिन्दी / Hindi</option><option value="en">English</option></select></div>
      </div>
      <label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I have read the <Link href="/privacy" target="_blank">Privacy Policy</Link> and consent to storing my profile and learning activity.</span></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-btn registration-submit" disabled={busy} onClick={submit}>{busy ? <LoaderCircle className="spin" size={18} /> : null} Complete registration <ArrowRight size={18} /></button>
      <p className="auth-small">Only Railway Group D is active. Other exams will open when ready.</p>
    </div></main>
  </div>;
}
