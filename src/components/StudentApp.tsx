"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, BookOpen, Bookmark, ChartNoAxesCombined, ChevronDown, CircleHelp, Download, Home, LibraryBig, LogOut, Menu, MessageCircle, MoreHorizontal, Settings2, Share2, Star, UserRound, X, ClipboardList, GraduationCap, FileText, LayoutDashboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { signOut } from "firebase/auth";
import { Brand } from "@/components/Shared";
import { StudentScreens } from "@/components/StudentScreens";
import { QuizExperience } from "@/components/QuizExperience";
import { apiRequest, postJson } from "@/lib/client-api";
import { APP_NAME, APP_SUBTITLE_HI } from "@/lib/branding";
import { translate } from "@/lib/i18n";
import { historyStack, isSecondBackPress, screenHash } from "@/lib/navigation";
import { getPhoneAuth } from "@/lib/firebase-client";
import { clearLocalAttemptDrafts, clearOfflineDocuments } from "@/lib/offline";
import type { AppData, Screen } from "@/lib/types";

type ConfirmState = { title: string; description: string; action: () => void; label?: string };
const bottomItems: Array<{ name: string; key: "home" | "courses" | "downloads" | "chat" | "more"; icon: LucideIcon }> = [
  { name: "home", key: "home", icon: Home }, { name: "my-courses", key: "courses", icon: GraduationCap },
  { name: "downloads", key: "downloads", icon: Download }, { name: "chat", key: "chat", icon: MessageCircle },
  { name: "more", key: "more", icon: MoreHorizontal },
];

export function StudentApp({ data, onData, refresh, onLogout, toast }: { data: AppData; onData: (data: AppData) => void; refresh: () => Promise<void>; onLogout: () => void; toast: (message: string) => void }) {
  const [stack, setStack] = useState<Screen[]>([{ name: "home" }]);
  const stackRef = useRef(stack);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const drawerRef = useRef(false);
  const confirmRef = useRef(false);
  const backPriorityRef = useRef<(() => boolean) | null>(null);
  const lastBack = useRef(0);
  const historySeq = useRef(0);
  const leavingWebApp = useRef(false);
  const screen = stack[stack.length - 1];
  const language = data.user.preferredLanguage;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const unread = data.notifications.filter((note) => !note.isRead).length;
  const appName = data.settings.appName || APP_NAME;
  const appSubtitle = data.settings.appSubtitle || APP_SUBTITLE_HI;

  const writeHistory = useCallback((nextStack: Screen[], replace = false, overlay?: "drawer" | "dialog") => {
    const seq = replace ? historySeq.current : ++historySeq.current;
    const state = { examApp: true, stack: nextStack, index: nextStack.length - 1, seq, ...(overlay ? { overlay } : {}) };
    if (replace) window.history.replaceState(state, "", screenHash(nextStack.at(-1)!));
    else window.history.pushState(state, "", screenHash(nextStack.at(-1)!));
  }, []);
  const navigate = useCallback((next: Screen) => {
    const previous = stackRef.current;
    const current = previous.at(-1)!;
    if (current.name === next.name && current.id === next.id) return;
    const replace = next.name === "result" && current.name === "attempt";
    const nextStack = next.name === "home" ? [next] : replace ? [...previous.slice(0, -1), next] : [...previous, next];
    stackRef.current = nextStack;
    setStack(nextStack);
    lastBack.current = 0;
    leavingWebApp.current = false;
    writeHistory(nextStack, replace);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [writeHistory]);
  const closeOverlay = useCallback(() => {
    drawerRef.current = false;
    confirmRef.current = false;
    setDrawerOpen(false);
    setConfirmState(null);
    writeHistory(stackRef.current, true);
  }, [writeHistory]);
  const openDrawer = useCallback(() => {
    if (drawerRef.current || confirmRef.current) return;
    drawerRef.current = true;
    setDrawerOpen(true);
    lastBack.current = 0;
    writeHistory(stackRef.current, false, "drawer");
  }, [writeHistory]);
  const askConfirm = useCallback((title: string, description: string, action: () => void, label?: string) => {
    if (drawerRef.current) closeOverlay();
    if (!confirmRef.current) writeHistory(stackRef.current, false, "dialog");
    confirmRef.current = true;
    setConfirmState({ title, description, action, label });
    lastBack.current = 0;
  }, [closeOverlay, writeHistory]);
  const registerBackPriority = useCallback((handler: (() => boolean) | null) => {
    backPriorityRef.current = handler;
  }, []);
  const goBack = useCallback(() => {
    if (backPriorityRef.current?.()) { lastBack.current = 0; return; }
    if (drawerRef.current || confirmRef.current || stackRef.current.length > 1) { window.history.back(); return; }
    const now = Date.now();
    if (isSecondBackPress(lastBack.current, now)) {
      lastBack.current = 0;
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") void CapacitorApp.exitApp();
      else { leavingWebApp.current = true; window.history.back(); }
    } else { lastBack.current = now; toast("Press back again to exit"); }
  }, [toast]);
  useEffect(() => {
    const root: Screen[] = [{ name: "home" }];
    if (!historyStack(window.history.state)) {
      window.history.replaceState({ examEntry: true }, "", window.location.pathname + window.location.search);
      historySeq.current = 0;
      writeHistory(root);
    } else {
      historySeq.current = Number(window.history.state?.seq) || 0;
      writeHistory(root, true);
    }
    const onPop = (event: PopStateEvent) => {
      const target = historyStack(event.state);
      const targetSeq = Number(event.state?.seq) || 0;
      if (confirmRef.current || drawerRef.current) {
        confirmRef.current = false;
        drawerRef.current = false;
        setConfirmState(null);
        setDrawerOpen(false);
        historySeq.current = targetSeq;
        lastBack.current = 0;
        return;
      }
      if (backPriorityRef.current?.()) {
        lastBack.current = 0;
        writeHistory(stackRef.current);
        return;
      }
      if (leavingWebApp.current) {
        // A browser cannot close its tab. Skip our own history entries on the
        // second Back; Capacitor uses App.exitApp() instead.
        if (target || event.state?.examEntry) window.history.back();
        return;
      }
      const current = stackRef.current;
      if (target && targetSeq > historySeq.current) {
        historySeq.current = targetSeq;
        stackRef.current = target;
        setStack(target);
        lastBack.current = 0;
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
      }
      if (current.length > 1) {
        if (target && target.length >= current.length) {
          // Drawer/dialog actions can leave an equivalent history entry. One
          // Back should still return to the previous visible screen.
          historySeq.current = targetSeq;
          window.history.back();
          return;
        }
        const previous = target || root;
        historySeq.current = targetSeq;
        stackRef.current = previous;
        setStack(previous);
        lastBack.current = 0;
        if (current.at(-1)?.name === "attempt") toast("Your unfinished test is kept for this attempt. You can resume it later.");
        if (!target) writeHistory(root);
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
      }
      historySeq.current = targetSeq;
      const now = Date.now();
      if (isSecondBackPress(lastBack.current, now)) {
        lastBack.current = 0;
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") void CapacitorApp.exitApp();
        else { leavingWebApp.current = true; window.history.back(); }
      } else {
        lastBack.current = now;
        toast("Press back again to exit");
        writeHistory(root);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [toast, writeHistory]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    let removed = false;
    let listener: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener("backButton", () => { goBack(); }).then((handle) => {
      if (removed) void handle.remove(); else listener = handle;
    });
    return () => { removed = true; if (listener) void listener.remove(); };
  }, [goBack]);

  const goTo = useCallback((next: Screen) => {
    if (drawerRef.current) closeOverlay();
    navigate(next);
  }, [closeOverlay, navigate]);
  const toggleBookmark = async (itemType: "topic" | "document" | "question", itemId: string) => {
    const exists = data.bookmarks.some((item) => item.itemType === itemType && item.itemId === itemId);
    onData({ ...data, bookmarks: exists ? data.bookmarks.filter((item) => !(item.itemType === itemType && item.itemId === itemId)) : [...data.bookmarks, { itemType, itemId }] });
    try { await postJson("/api/profile", { action: "toggleBookmark", itemType, itemId }); }
    catch (error) { await refresh(); toast((error as Error).message); }
  };
  const toggleTopic = async (topicId: string) => {
    const exists = data.completedTopicIds.includes(topicId);
    onData({ ...data, completedTopicIds: exists ? data.completedTopicIds.filter((id) => id !== topicId) : [...data.completedTopicIds, topicId] });
    try { await postJson("/api/profile", { action: "toggleTopic", topicId }); }
    catch (error) { await refresh(); toast((error as Error).message); }
  };
  const markRead = async (notificationId: string) => {
    onData({ ...data, notifications: data.notifications.map((note) => note.id === notificationId ? { ...note, isRead: true } : note) });
    try { await postJson("/api/profile", { action: "markRead", notificationId }); }
    catch (error) { await refresh(); toast((error as Error).message); }
  };
  const markAllRead = async () => {
    onData({ ...data, notifications: data.notifications.map((note) => ({ ...note, isRead: true })) });
    try { await postJson("/api/profile", { action: "markAllRead" }); toast("All notifications marked as read."); }
    catch (error) { await refresh(); toast((error as Error).message); }
  };
  const openDocument = async (id: string) => {
    navigate({ name: "document-detail", id });
    onData({ ...data, recentDocumentIds: [id, ...data.recentDocumentIds.filter((item) => item !== id)] });
    try { await postJson("/api/profile", { action: "openDocument", documentId: id }); } catch { /* Reading is still available offline from the open page. */ }
  };
  const logout = () => askConfirm(
    data.user.isDemo ? "Close your guest study session?" : "Log out of your account?",
    data.user.isDemo
      ? "This session is not linked to an account. Signing out ends access to its saved progress."
      : "Your learning progress stays saved. You can sign back in anytime.",
    async () => {
    closeOverlay();
    try {
      await postJson("/api/auth", { action: "logout" });
      clearLocalAttemptDrafts();
      if (!data.user.isDemo) {
        try { await signOut(getPhoneAuth()); }
        catch { toast("App session closed, but Firebase sign-out could not be confirmed on this device. Clear browser data if it is shared."); }
      }
      try { await clearOfflineDocuments(data.user.id); }
      catch { toast("App session closed, but offline files could not be cleared. Remove this site's data on a shared device."); }
      onLogout();
    } catch (error) { toast((error as Error).message); }
  }, data.user.isDemo ? "Close session" : "Log out");
  const share = async () => {
    const details = { title: appName, text: "A simple space to prepare for Railway Group D.", url: window.location.origin };
    try { if (navigator.share) await navigator.share(details); else { await navigator.clipboard.writeText(details.url); toast("App link copied to clipboard."); } }
    catch (error) { if ((error as DOMException).name !== "AbortError") toast("Sharing is not available on this device."); }
  };
  const rate = () => { const url = data.settings.storeUrl; if (url?.startsWith("https://")) window.open(url, "_blank", "noopener,noreferrer"); else toast("A store listing is not available yet. Thank you for your support!"); };
  const menu = [
    { label: t("home"), icon: Home, screen: "home" }, { label: t("courses"), icon: GraduationCap, screen: "my-courses" },
    { label: t("dailyQuiz"), icon: ClipboardList, screen: "quizzes" }, { label: t("mockTest"), icon: TimerIcon, screen: "tests" },
    { label: t("syllabus"), icon: BookOpen, screen: "syllabus" }, { label: t("library"), icon: LibraryBig, screen: "library" },
    { label: t("progress"), icon: ChartNoAxesCombined, screen: "progress" }, { label: t("bookmarks"), icon: Bookmark, screen: "bookmarks" },
  ];
  const activeBottom = bottomItems.find((item) => item.name === screen.name)?.name || (screen.name === "home" ? "home" : "");
  const contentProps = { screen, data, navigate: goTo, goBack, toast, askConfirm, refresh, toggleBookmark, toggleTopic, markRead, markAllRead, openDocument, onData, share, rate, logout };
  return <div className="app-shell"><aside className="desktop-sidebar"><div className="sidebar-brand"><Brand name={appName} subtitle={appSubtitle} logoUrl={data.settings.logoUrl} small /></div><div className="sidebar-scroll"><span className="sidebar-caption">YOUR SPACE</span><nav aria-label="Main navigation">{menu.map((item) => <button key={item.screen} className={`sidebar-link ${screen.name === item.screen ? "selected" : ""}`} onClick={() => goTo({ name: item.screen })}><item.icon size={20} strokeWidth={1.9} /><span>{item.label}</span>{screen.name === item.screen && <span className="sidebar-active-dot" />}</button>)}</nav><span className="sidebar-caption sidebar-caption-gap">MORE TO EXPLORE</span><nav aria-label="More navigation"><button className="sidebar-link" onClick={() => goTo({ name: "papers" })}><FileText size={20} />{t("papers")}</button><button className="sidebar-link" onClick={() => goTo({ name: "job-alerts" })}><Bell size={20} />{t("alerts")}</button></nav></div><div className="sidebar-bottom"><div className="sidebar-help"><div className="sidebar-help-icon"><CircleHelp size={19} /></div><strong>Need a little help?</strong><p>We’re here for your study journey.</p><button onClick={() => goTo({ name: "help" })}>Visit help center <ArrowRight size={14} /></button></div><button className="sidebar-link sidebar-settings" onClick={() => goTo({ name: "settings" })}><Settings2 size={19} />{t("settings")}</button></div></aside>
    <div className="app-main"><header className="topbar"><div className="topbar-left"><button className="icon-button" aria-label="Open menu" onClick={openDrawer}><Menu size={23} /></button><span className="topbar-divider" /><span className="topbar-breadcrumb">{appName}</span></div><button className="exam-select" onClick={() => goTo({ name: "exams" })}>{t("exams")} <ChevronDown size={17} /></button><div className="topbar-right"><button className="topbar-lang" onClick={() => goTo({ name: "settings" })}>{language === "hi" ? "हि / EN" : "EN / हि"}</button><button className="icon-button bell-button" aria-label={`${t("notifications")}${unread ? `, ${unread} unread` : ""}`} onClick={() => goTo({ name: "notifications" })}><Bell size={21} />{unread > 0 && <span className="unread-dot" />}</button><button className="topbar-avatar" aria-label="Open profile" onClick={() => goTo({ name: "profile" })}>{data.user.name ? data.user.name.slice(0, 1).toUpperCase() : "G"}</button></div></header>
      <main className="app-content">{["quiz-instructions", "attempt", "result"].includes(screen.name) ? <QuizExperience screen={screen} data={data} language={language} navigate={goTo} goBack={goBack} toast={toast} askConfirm={askConfirm} registerBackPriority={registerBackPriority} refresh={refresh} toggleBookmark={(type, id) => void toggleBookmark(type, id)} /> : <StudentScreens {...contentProps} />}</main>
    </div><nav className="bottom-nav" aria-label="Bottom navigation">{bottomItems.map((item) => <button key={item.name} className={activeBottom === item.name ? "active" : ""} onClick={() => goTo({ name: item.name })}><item.icon size={21} strokeWidth={activeBottom === item.name ? 2.4 : 1.8} /><span>{t(item.key)}</span></button>)}</nav>
    {drawerOpen && <div className="overlay-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) goBack(); }}><aside className="app-drawer" aria-label="Navigation drawer"><div className="drawer-header"><Brand name={appName} subtitle={appSubtitle} logoUrl={data.settings.logoUrl} small light /><button className="drawer-close" onClick={goBack} aria-label="Close menu"><X size={20} /></button><div className="drawer-user"><div className="drawer-avatar">{data.user.name ? data.user.name.slice(0, 1).toUpperCase() : "G"}</div><strong>{data.user.name || "Guest"}</strong><span>{data.user.verifiedPhone ? data.user.phoneNumber : "Guest study session"}</span></div></div><div className="drawer-items"><button onClick={() => goTo({ name: "home" })}><Home size={19} />{t("home")}<ArrowRight size={15} /></button><button onClick={() => goTo({ name: "purchases" })}><BookOpen size={19} />{t("purchases")}<ArrowRight size={15} /></button><button onClick={() => goTo({ name: "settings" })}><Settings2 size={19} />{t("settings")}<ArrowRight size={15} /></button><button onClick={() => { closeOverlay(); void share(); }}><Share2 size={19} />{t("share")}<ArrowRight size={15} /></button><button onClick={() => { closeOverlay(); rate(); }}><Star size={19} />{t("rate")}<ArrowRight size={15} /></button><button className="drawer-logout" onClick={() => { closeOverlay(); logout(); }}><LogOut size={19} />{t("logout")}<ArrowRight size={15} /></button></div><div className="drawer-footer">{appName} · No ads, just learning.</div></aside></div>}
    {confirmState && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) goBack(); }}><div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div className="confirm-icon"><CircleHelp size={23} /></div><h2 id="confirm-title">{confirmState.title}</h2><p>{confirmState.description}</p><div className="confirm-actions"><button className="outline-btn" onClick={goBack}>Cancel</button><button className="primary-btn" onClick={() => { const action = confirmState.action; closeOverlay(); action(); }}>{confirmState.label || "Confirm"}</button></div></div></div>}
  </div>;
}

const TimerIcon = ClipboardList;
