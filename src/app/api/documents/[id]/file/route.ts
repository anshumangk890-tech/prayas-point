import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documentFiles, documents } from "@/db/schema";
import { ApiError, getSession, jsonError } from "@/lib/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Please sign in to open this file.");
    const { id } = await context.params;
    if (!id || id.length > 120) throw new ApiError(400, "Invalid document.");
    const [document] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!document || (!document.isPublished && session.role !== "admin")) throw new ApiError(404, "Document not found.");
    const download = new URL(request.url).searchParams.get("download") === "1";
    if (download && !document.downloadAllowed && session.role !== "admin") throw new ApiError(403, "Downloading is not permitted for this file.");
    const [file] = await db.select().from(documentFiles).where(eq(documentFiles.documentId, id)).limit(1);
    if (!file) throw new ApiError(404, "No PDF has been uploaded for this document.");
    const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const bytes = Buffer.from(file.base64Data, "base64");
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/pdf", "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return jsonError(error); }
}
