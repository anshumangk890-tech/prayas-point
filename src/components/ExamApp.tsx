"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { RegistrationScreen, WelcomeScreen } from "@/components/AuthScreens";
import { LoadingScreen } from "@/components/Shared";
import { StudentApp } from "@/components/StudentApp";
import { apiRequest } from "@/lib/client-api";
import { APP_NAME, APP_SUBTITLE_HI } from "@/lib/branding";
import type { AppData } from "@/lib/types";

type Bootstrap = { authenticated: boolean; role?: string; data?: AppData; branding?: Record<string, string>; firebaseConfigured?: boolean };

export function ExamApp() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<AppData | null>(null);
  const [branding, setBranding] = useState<Record<string, string>>({ appName: APP_NAME, appSubtitle: APP_SUBTITLE_HI });
  const [toastMessage, setToastMessage] = useState("");
  const [welcomeSplash, setWelcomeSplash] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const toast = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = window.setTimeout(() => setToastMessage(""), 3600);
  }, []);
  const load = useCallback(async () => {
    setError(""); setLoading(true);
    const firstVisit = !sessionStorage.getItem("exam-splash-seen");
    const started = Date.now();
    try {
      const response = await apiRequest<Bootstrap>("/api/bootstrap");
      if (response.role === "admin") { window.location.replace("/admin"); return; }
      if (response.branding) setBranding(response.branding);
      setData(response.authenticated && response.data ? response.data : null);
      if (response.data) setBranding(response.data.settings);
      const minimum = firstVisit ? 850 : 100;
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, minimum - (Date.now() - started))));
      sessionStorage.setItem("exam-splash-seen", "1");
    } catch (cause) { setError((cause as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(timer); window.clearTimeout(toastTimer.current); };
  }, [load]);
  const refresh = useCallback(async () => {
    const response = await apiRequest<Bootstrap>("/api/bootstrap");
    if (response.data) { setData(response.data); setBranding(response.data.settings); }
    else if (!response.authenticated) setData(null);
  }, []);
  const onStudyOpened = (next: AppData) => { setData(next); setBranding(next.settings); };
  const onComplete = (next: AppData) => { setWelcomeSplash(true); window.setTimeout(() => { setData(next); setWelcomeSplash(false); }, 650); };
  if (loading || welcomeSplash) return <LoadingScreen name={branding.appName || APP_NAME} subtitle={branding.appSubtitle || APP_SUBTITLE_HI} message={welcomeSplash ? "Your learning journey begins now..." : "Preparing your study space..."} />;
  if (error) return <div className="startup-error"><div><AlertCircle size={28} /><h1>We couldn’t open your study space.</h1><p>{error}</p><button className="primary-btn" onClick={() => void load()}>Try again <ArrowRight size={17} /></button></div></div>;
  return <>
    <div className="app-root">
      {data ? data.user.registrationCompleted
        ? <StudentApp data={data} onData={setData} refresh={refresh} onLogout={() => setData(null)} toast={toast} />
        : <RegistrationScreen data={data} onComplete={onComplete} toast={toast} />
        : <WelcomeScreen branding={branding} onOpen={onStudyOpened} />}
    </div>
    {toastMessage && <div className="app-toast" role="status">{toastMessage}</div>}
  </>;
}
