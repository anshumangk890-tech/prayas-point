import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getAppData } from "@/lib/data";
import { ensureSeed } from "@/lib/seed";
import { firebaseConfigured, getSession, jsonError } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeed();
    const session = await getSession();
    if (session?.role === "student") return Response.json({ authenticated: true, role: "student", data: await getAppData(session.user), firebaseConfigured: firebaseConfigured() }, { headers: { "Cache-Control": "no-store" } });
    if (session?.role === "admin") return Response.json({ authenticated: true, role: "admin", admin: { email: session.admin.email, displayName: session.admin.displayName } }, { headers: { "Cache-Control": "no-store" } });
    const settings = await db.select().from(appSettings);
    const branding = Object.fromEntries(settings.map((item) => [item.key, item.value]));
    return Response.json({ authenticated: false, firebaseConfigured: firebaseConfigured(), branding }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}
