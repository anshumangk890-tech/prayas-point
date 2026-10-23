import type { ReactNode } from "react";
import { ArrowRight, BookOpen, LoaderCircle } from "lucide-react";
import { APP_NAME, APP_SUBTITLE_HI } from "@/lib/branding";

export function Brand({ name = APP_NAME, subtitle = APP_SUBTITLE_HI, logoUrl, small = false, light = false }: { name?: string; subtitle?: string; logoUrl?: string; small?: boolean; light?: boolean }) {
  return <div className={`brand ${small ? "brand-small" : ""} ${light ? "brand-light" : ""}`}>
    <span className="brand-mark"><img src={logoUrl || "/images/exam-logo.svg"} alt={`${name} logo`} /></span>
    <span className="brand-copy"><strong>{name}</strong><small lang="hi">{subtitle}</small></span>
  </div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "red" | "green" | "neutral" | "amber" }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

export function EmptyState({ icon, title, description, action, compact = false }: { icon?: ReactNode; title: string; description: string; action?: { label: string; onClick: () => void }; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "empty-compact" : ""}`}>
    <div className="empty-icon">{icon || <BookOpen size={23} strokeWidth={1.8} />}</div>
    <h3>{title}</h3><p>{description}</p>
    {action && <button className="text-action" onClick={action.onClick} type="button">{action.label}<ArrowRight size={16} /></button>}
  </div>;
}

export function LoadingScreen({ message = "Preparing your study space...", name = APP_NAME, subtitle = APP_SUBTITLE_HI }: { message?: string; name?: string; subtitle?: string }) {
  return <div className="loading-screen" role="status" aria-live="polite">
    <div className="loading-logo"><img src="/images/exam-logo.svg" alt="" /></div>
    <h1>{name}</h1><span className="loading-subtitle" lang="hi">{subtitle}</span><p>{message}</p><LoaderCircle className="spin" size={19} aria-hidden="true" />
  </div>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: { label: string; onClick: () => void } }) {
  return <div className="section-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action && <button className="section-link" onClick={action.onClick} type="button">{action.label}<ArrowRight size={16} /></button>}</div>;
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return <div className="progress-track" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>;
}
