import { Hono } from "hono";
import { Bindings } from "../types";
import { createDbClient } from "../db/client";
import { validateSession } from "../lib/auth/session";
import { images, analyses } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { consumeUserCredit } from "../lib/credits/consume";
import { refundUserCredit } from "../lib/credits/refund";
import { getFromR2 } from "../lib/storage/get-from-r2";
import { retryWithBackoff } from "../lib/ai/retry-with-backoff";
import { analyzeImageWithGemini } from "../lib/ai/analyze-with-gemini";
import { z } from "zod";

import { generateAnalysisPDF } from "../lib/pdf/generate-analysis-pdf";

const app = new Hono<{ Bindings: Bindings }>();

const analyzeSchema = z.object({
  imageId: z.number(),
});

const generatePdfSchema = z.object({
  analysisId: z.number(),
});

// const CDN_URL = "https://cdn.vidrieraencasa.com";

app.post("/generate-pdf", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);
  const sessionData = await validateSession(db, token);
  if (!sessionData) return c.json({ error: "Unauthorized" }, 401);
  const { user } = sessionData;

  const body = await c.req.json();
  const validation = generatePdfSchema.safeParse(body);
  if (!validation.success) return c.json({ error: "Invalid body" }, 400);
  const { analysisId } = validation.data;

  try {
    const analysis = await db.query.analyses.findFirst({
      where: eq(analyses.id, analysisId),
      with: {
        image: true,
      },
    });

    if (!analysis) return c.json({ error: "Analysis not found" }, 404);
    if (analysis.userId !== user.id) return c.json({ error: "Forbidden" }, 403);
    if (!analysis.diagnosis)
      return c.json({ error: "Analysis not completed" }, 400);

    // Get image from R2
    const imageBuffer = await getFromR2(c.env.STORAGE, analysis.image.r2Key);
    if (!imageBuffer) return c.json({ error: "Image not found" }, 404);

    // Generate PDF
    const pdfBuffer = await generateAnalysisPDF({
      imageBuffer,
      analysisDate: analysis.createdAt,
      diagnosis: JSON.parse(analysis.diagnosis),
    });

    // Upload PDF to R2
    const pdfKey = `reports/${user.id}/${analysis.id}.pdf`;
    await c.env.STORAGE.put(pdfKey, pdfBuffer, {
      httpMetadata: {
        contentType: "application/pdf",
      },
    });

    // Update analysis record
    await db
      .update(analyses)
      .set({ pdfR2Key: pdfKey })
      .where(eq(analyses.id, analysisId));

    return c.json({ success: true, pdfKey });
  } catch (error) {
    console.error("Failed to generate PDF", error);
    return c.json({ error: "Failed to generate PDF" }, 500);
  }
});

app.get("/:id/pdf-url", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);
  const sessionData = await validateSession(db, token);
  if (!sessionData) return c.json({ error: "Unauthorized" }, 401);
  const { user } = sessionData;

  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const analysis = await db.query.analyses.findFirst({
    where: eq(analyses.id, id),
  });

  if (!analysis) return c.json({ error: "Analysis not found" }, 404);
  if (analysis.userId !== user.id) return c.json({ error: "Forbidden" }, 403);
  if (!analysis.pdfR2Key) return c.json({ error: "PDF not generated" }, 404);

  // Generate signed URL? Or public URL?
  // Assuming R2 public bucket or simple pass through?
  // Since we are using R2 bindings, we can't easily generate signed URL without S3 compat client.
  // For now, let's proxy the file or assume we have a way to serve it.
  // The requirement said "get-pdf-download-url.ts".

  // If the bucket is private, we should return a presigned URL or serve the content.
  // But serving content via GET /pdf-url is not "download url".

  // Let's create an endpoint to SERVE the PDF: GET /analysis/:id/pdf
  // And this endpoint will return the content.
  // But for "download url", maybe we return the API endpoint itself?

  // Let's implement a GET /:id/pdf endpoint that returns the PDF file directly.
  return c.json({
    success: true,
    url: `${c.env.CDN_URL}/${analysis.pdfR2Key}`,
  });
});

app.get("/r2/*", async (c) => {
  // This is a helper to serve R2 files if needed, but better to use specific endpoints.
  // Let's stick to specific logic.
  return c.notFound();
});

app.get("/:id/pdf", async (c) => {
  const authHeader = c.req.header("Authorization");
  // Allow download with token in query param? Or standard auth header?
  // If it's a download link in browser, header is hard.
  // Let's assume standard auth for now.
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);
  const sessionData = await validateSession(db, token);
  if (!sessionData) return c.json({ error: "Unauthorized" }, 401);
  const { user } = sessionData;

  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const analysis = await db.query.analyses.findFirst({
    where: eq(analyses.id, id),
  });

  if (!analysis) return c.json({ error: "Analysis not found" }, 404);
  if (analysis.userId !== user.id) return c.json({ error: "Forbidden" }, 403);
  if (!analysis.pdfR2Key) return c.json({ error: "PDF not generated" }, 404);

  const object = await c.env.STORAGE.get(analysis.pdfR2Key);
  if (!object) return c.json({ error: "File not found" }, 404);

  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="analisis-${id}.pdf"`);
  return c.body(await object.arrayBuffer());
});

app.post("/analyze", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);
  const sessionData = await validateSession(db, token);
  if (!sessionData) return c.json({ error: "Unauthorized" }, 401);
  const { user } = sessionData;

  const body = await c.req.json();
  const validation = analyzeSchema.safeParse(body);
  if (!validation.success) return c.json({ error: "Invalid body" }, 400);
  const { imageId } = validation.data;

  let analysisId: number | null = null;
  let creditConsumed = false;

  try {
    // Verify image exists and belongs to user
    const image = await db.query.images.findFirst({
      where: eq(images.id, imageId),
    });

    if (!image) return c.json({ error: "La imagen no existe" }, 404);
    if (image.userId !== user.id)
      return c.json(
        { error: "No tienes permiso para analizar esta imagen" },
        403
      );

    // Create analysis record
    const [analysisRecord] = await db
      .insert(analyses)
      .values({
        userId: user.id,
        imageId: imageId,
        status: "pending",
        diagnosis: null,
        pdfR2Key: null,
        createdAt: new Date(),
        completedAt: null,
      })
      .returning();

    if (!analysisRecord)
      return c.json({ error: "No se pudo crear el registro de análisis" }, 500);
    analysisId = analysisRecord.id;

    // Consume credit
    const creditResult = await consumeUserCredit(db, user.id, analysisId);
    if (!creditResult.success) {
      await db
        .update(analyses)
        .set({ status: "failed" })
        .where(eq(analyses.id, analysisId));
      return c.json({ error: creditResult.error }, 402); // Payment Required
    }
    creditConsumed = true;

    // Update status to processing
    await db
      .update(analyses)
      .set({ status: "processing" })
      .where(eq(analyses.id, analysisId));

    // Retrieve image from R2
    const imageBuffer = await getFromR2(c.env.STORAGE, image.r2Key);
    if (!imageBuffer)
      throw new Error("No se pudo recuperar la imagen del almacenamiento");

    // Analyze with Gemini
    const diagnosis = await retryWithBackoff(() =>
      analyzeImageWithGemini(imageBuffer, c.env.GEMINI_API_KEY)
    );

    const diagnosisJson = JSON.stringify(diagnosis);

    await db
      .update(analyses)
      .set({
        status: "completed",
        diagnosis: diagnosisJson,
        completedAt: new Date(),
      })
      .where(eq(analyses.id, analysisId));

    return c.json({
      success: true,
      analysisId,
      diagnosis,
    });
  } catch (error) {
    console.error("Failed to analyze image", error);

    // Refund credit
    if (creditConsumed && analysisId) {
      try {
        await refundUserCredit(db, user.id, analysisId);
      } catch (refundError) {
        console.error("Failed to refund credit", refundError);
      }
    }

    // Update status to failed
    if (analysisId) {
      try {
        await db
          .update(analyses)
          .set({ status: "failed" })
          .where(eq(analyses.id, analysisId));
      } catch (updateError) {
        console.error("Failed to update analysis status", updateError);
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    let userError = "No pudimos completar el análisis";

    if (errorMessage.includes("rate limit"))
      userError = "El servicio está temporalmente ocupado";
    if (errorMessage.includes("network"))
      userError = "Error de conexión con el servicio de análisis";

    return c.json({ error: userError }, 500);
  }
});

app.get("/history", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);
  const sessionData = await validateSession(db, token);
  if (!sessionData) return c.json({ error: "Unauthorized" }, 401);
  const { user } = sessionData;

  // Pagination
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const history = await db.query.analyses.findMany({
    where: eq(analyses.userId, user.id),
    orderBy: [desc(analyses.createdAt)],
    limit: limit,
    offset: offset,
    with: {
      image: true,
    },
  });

  const historyWithUrls = history.map((item) => ({
    ...item,
    imageUrl: `${c.env.CDN_URL}/${item.image.r2Key}`,
    pdfUrl: item.pdfR2Key ? `${c.env.CDN_URL}/${item.pdfR2Key}` : null,
  }));

  return c.json({ success: true, history: historyWithUrls, page, limit });
});

app.get("/:id", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);
  const sessionData = await validateSession(db, token);
  if (!sessionData) return c.json({ error: "Unauthorized" }, 401);
  const { user } = sessionData;

  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const analysis = await db.query.analyses.findFirst({
    where: eq(analyses.id, id),
    with: {
      image: true,
    },
  });

  if (!analysis) return c.json({ error: "Analysis not found" }, 404);
  if (analysis.userId !== user.id) return c.json({ error: "Forbidden" }, 403);

  return c.json({
    success: true,
    analysis: {
      ...analysis,
      imageUrl: `${c.env.CDN_URL}/${analysis.image.r2Key}`,
      pdfUrl: analysis.pdfR2Key
        ? `${c.env.CDN_URL}/${analysis.pdfR2Key}`
        : null,
    },
  });
});

export default app;
