import type { Metadata } from "next";
import { AdminApp } from "@/components/AdminApp";
import { APP_NAME } from "@/lib/branding";

export const metadata: Metadata = { title: `Admin Studio | ${APP_NAME}` };
export const dynamic = "force-dynamic";
export default function AdminPage() { return <AdminApp />; }
