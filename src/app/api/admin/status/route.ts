import { db } from "@/db";
import { adminAccounts } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { ensureAdminProvisioned, getSession, jsonError } from "@/lib/server";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await ensureSeed();
    await ensureAdminProvisioned();
    const session = await getSession();
    const [admin] = await db.select({ id: adminAccounts.id }).from(adminAccounts).limit(1);
    return Response.json({ authenticated: session?.role === "admin", provisioned: Boolean(admin), admin: session?.role === "admin" ? { email: session.admin.email, displayName: session.admin.displayName } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}
