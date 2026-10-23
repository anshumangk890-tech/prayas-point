import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, documentFiles, documents } from "@/db/schema";
import { ApiError, checkOrigin, jsonError, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin();
    const form = await request.formData();
    const documentId = form.get("documentId");
    const file = form.get("file");
    if (typeof documentId !== "string" || documentId.length > 120 || !(file instanceof File)) throw new ApiError(400, "Choose a document and PDF file.");
    const [document] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    if (!document || !["pdf", "paper"].includes(document.documentType)) throw new ApiError(400, "Create a PDF or paper record first.");
    if (file.size === 0 || file.size > 8 * 1024 * 1024) throw new ApiError(400, "PDF must be smaller than 8 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-" || !file.name.toLowerCase().endsWith(".pdf")) throw new ApiError(400, "Only valid PDF files are supported.");
    await db.insert(documentFiles).values({ documentId, fileName: file.name.slice(0, 180), mimeType: "application/pdf", base64Data: bytes.toString("base64"), sizeBytes: file.size })
      .onConflictDoUpdate({ target: documentFiles.documentId, set: { fileName: file.name.slice(0, 180), mimeType: "application/pdf", base64Data: bytes.toString("base64"), sizeBytes: file.size } });
    await db.insert(auditLogs).values({ id: randomUUID(), adminId: admin.id, action: "upload", resource: "documents", resourceId: documentId, detail: `PDF uploaded (${file.size} bytes)` });
    return Response.json({ ok: true, sizeBytes: file.size });
  } catch (error) { return jsonError(error); }
}
