import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
  RGB,
} from "pdf-lib";

interface DiagnosisData {
  score: number;
  overallAssessment: string;
  focalPoints: string;
  lighting: string;
  signage: string;
  distribution: string;
  strengths: string[];
  issues: string[];
  priorityFixes: string[];
  recommendations: string[];
  suggestedSignageText: string;
}

interface GeneratePDFOptions {
  imageBuffer: ArrayBuffer;
  logoBuffer?: ArrayBuffer | Uint8Array;
  analysisDate: Date;
  diagnosis: DiagnosisData;
}

// --- Theme Colors (Web-matched) ---
const COLORS = {
  bg: rgb(0.02, 0.04, 0.08), // Dark navy background
  card: rgb(0.06, 0.09, 0.16), // Slightly lighter card background
  primaryText: rgb(1, 1, 1),
  secondaryText: rgb(0.6, 0.65, 0.75),
  accent: rgb(0.4, 0.5, 1.0), // Blue
  success: rgb(0.2, 0.8, 0.4), // Green
  warning: rgb(1.0, 0.7, 0.2), // Yellow
  danger: rgb(0.9, 0.3, 0.3), // Red
  purple: rgb(0.6, 0.4, 0.9),
};

/**
 * Generate PDF report for analysis
 */
export async function generateAnalysisPDF(
  options: GeneratePDFOptions
): Promise<ArrayBuffer> {
  const { imageBuffer, logoBuffer, analysisDate, diagnosis } = options;

  try {
    const pdfDoc = await PDFDocument.create();
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const margin = 40;
    const width = 595; // A4 Width
    const height = 842; // A4 Height
    const contentWidth = width - 2 * margin;

    // --- PAGE MANAGEMENT ---
    let page = pdfDoc.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.bg });

    let yPos = height - margin;

    // Helper to add new page if needed
    const checkPageBreak = (neededHeight: number) => {
      if (yPos - neededHeight < margin) {
        page = pdfDoc.addPage([width, height]);
        page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.bg });
        yPos = height - margin;
        return true;
      }
      return false;
    };

    // --- INTERNAL HELPERS FOR PAGINATION ---

    const drawListInternal = (
      title: string,
      items: string[],
      x: number,
      w: number,
      color: RGB
    ) => {
      // Draw Title
      checkPageBreak(30);
      page.drawText(title, {
        x,
        y: yPos,
        size: 14,
        font: boldFont,
        color: color,
      });
      yPos -= 20;

      for (const item of items) {
        const wrapped = wrapText(item, w - 20, regularFont, 9);
        const itemH = wrapped.length * 13 + 5;

        checkPageBreak(itemH);

        // Bullet
        page.drawCircle({ x: x + 5, y: yPos - 5, size: 2, color: color });

        let ty = yPos - 8;
        for (const line of wrapped) {
          page.drawText(line, {
            x: x + 15,
            y: ty,
            size: 9,
            font: regularFont,
            color: COLORS.secondaryText,
          });
          ty -= 13;
        }
        yPos -= itemH;
      }
    };

    // --- HEADER (First Page) ---
    // Logo
    if (logoBuffer) {
      try {
        console.log(
          "Attempting to embed logo, buffer size:",
          logoBuffer.byteLength
        );
        // Try embedding as PNG first
        let logoImage;
        try {
          logoImage = await pdfDoc.embedPng(logoBuffer);
        } catch (e) {
          console.log("PNG embed failed, trying JPG", e);
          try {
            logoImage = await pdfDoc.embedJpg(logoBuffer);
          } catch (e2) {
            console.log("JPG embed failed too", e2);
          }
        }

        if (logoImage) {
          const logoDims = logoImage.scale(0.15); // Scale down
          page.drawImage(logoImage, {
            x: margin,
            y: height - margin - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
          });
        } else {
          console.error("Could not create logoImage");
        }
      } catch (e) {
        console.error("Failed to embed logo", e);
      }
    }

    // Header Title
    page.drawText("Análisis Completo", {
      x: margin + 250,
      y: height - margin - 20,
      size: 24,
      font: boldFont,
      color: COLORS.primaryText,
    });

    const formattedDate = formatDate(analysisDate);
    page.drawText(`Generado el ${formattedDate}`, {
      x: margin + 250,
      y: height - margin - 40,
      size: 9,
      font: regularFont,
      color: COLORS.secondaryText,
    });

    yPos -= 80; // Move down after header

    // --- TOP SECTION: Image & Score ---
    const image = await pdfDoc.embedJpg(imageBuffer);
    const imgW = 230;
    const imgH = (image.height / image.width) * imgW;
    const sectionHeight = Math.max(imgH, 150) + 40;

    checkPageBreak(sectionHeight);

    // Image Card
    drawCard(page, margin, yPos - imgH - 20, imgW + 20, imgH + 20);
    page.drawImage(image, {
      x: margin + 10,
      y: yPos - imgH - 10,
      width: imgW,
      height: imgH,
    });

    // Score Ring
    const scoreX = margin + 330;
    const scoreY = yPos - 70;
    drawScoreRing(page, scoreX, scoreY, diagnosis.score, boldFont, regularFont);

    yPos -= sectionHeight;

    // --- RESUMEN DEL ANÁLISIS ---
    checkPageBreak(150); // Estimate needed space
    page.drawText("Resumen del Análisis", {
      x: margin,
      y: yPos,
      size: 16,
      font: boldFont,
      color: COLORS.primaryText,
    });
    yPos -= 25;

    yPos = drawSummaryBox(
      page,
      diagnosis.overallAssessment,
      yPos,
      margin,
      contentWidth,
      italicFont
    );
    yPos -= 40;

    // --- DIAGNÓSTICO ESPECÍFICO ---
    checkPageBreak(200);
    page.drawText("Diagnóstico Específico", {
      x: margin,
      y: yPos,
      size: 16,
      font: boldFont,
      color: COLORS.primaryText,
    });
    yPos -= 30;

    const colW = (contentWidth - 20) / 2;

    // Row 1
    const h1 =
      getTextHeight(diagnosis.focalPoints, colW - 30, regularFont, 9, 13) + 55;
    const h2 =
      getTextHeight(diagnosis.lighting, colW - 30, regularFont, 9, 13) + 55;
    const row1H = Math.max(h1, h2);

    checkPageBreak(row1H + 20);

    drawSpecCard(
      page,
      "PUNTOS FOCALES",
      diagnosis.focalPoints,
      margin,
      yPos,
      colW,
      boldFont,
      regularFont,
      COLORS.accent
    );
    drawSpecCard(
      page,
      "ILUMINACIÓN",
      diagnosis.lighting,
      margin + colW + 20,
      yPos,
      colW,
      boldFont,
      regularFont,
      COLORS.warning
    );

    yPos -= row1H + 20;

    // Row 2
    const h3 =
      getTextHeight(diagnosis.signage, colW - 30, regularFont, 9, 13) + 55;
    const h4 =
      getTextHeight(diagnosis.distribution, colW - 30, regularFont, 9, 13) + 55;
    const row2H = Math.max(h3, h4);

    checkPageBreak(row2H + 40);

    drawSpecCard(
      page,
      "CARTELERÍA",
      diagnosis.signage,
      margin,
      yPos,
      colW,
      boldFont,
      regularFont,
      COLORS.purple
    );
    drawSpecCard(
      page,
      "DISTRIBUCIÓN",
      diagnosis.distribution,
      margin + colW + 20,
      yPos,
      colW,
      boldFont,
      regularFont,
      COLORS.success
    );

    yPos -= row2H + 40;

    // --- LISTS (Fortalezas / Puntos a Mejorar) ---
    // Note: Breaking lists into columns is tricky with pagination.
    // If we want side-by-side lists that span pages, it's very complex.
    // Simpler approach: Draw one list then the other, or ensure they don't break page awkwardly.
    // Given the user wants "se corta en la mitad", pagination is key.
    // Side-by-side works if they fit. If not, maybe stack them?
    // Let's keep side-by-side but if one column flows to next page, it's weird.
    // Better: Render them sequentially if they are long?
    // Or just accept that if we break page, we break both columns.
    // Actually, `drawListInternal` handles its own Y position.
    // If we call it for left col, `yPos` goes down.
    // Then we call it for right col? We need to reset `yPos` to top of list for right col?
    // But if left col caused a page break, right col needs to start on new page too?
    // This is hard.
    // Alternative: Calculate max height of both lists. If > remaining space, break page.
    // If > full page, then we have a problem.
    // For now, let's assume they fit on one page OR stack them if safer.
    // Stacking them is safer for pagination.
    // Let's try stacking them to avoid complex column pagination issues.
    // "Fortalezas" followed by "Puntos a Mejorar".

    // User requested "mantener los colores" and likely layout.
    // Let's try to keep 2 columns but sync the Y position.
    // If we break page, we break for both.

    // Actually, let's iterate both lists simultaneously line by line? No.
    // Let's just calculate total height.
    const listColW = (contentWidth - 40) / 2;
    // We will render them side by side.
    // We need to track Y for left and right separately, but sync page breaks.
    // This is too complex for this script.
    // Let's render them stacked. It's cleaner for generated PDF reading anyway.
    // OR: Check if they fit. If not, stack.

    // Let's stack them for reliability.
    // "Fortalezas"
    drawListInternal(
      "Fortalezas",
      diagnosis.strengths,
      margin,
      contentWidth,
      COLORS.success
    );
    yPos -= 20;

    // "Puntos a Mejorar"
    drawListInternal(
      "Puntos a Mejorar",
      diagnosis.issues,
      margin,
      contentWidth,
      COLORS.warning
    );
    yPos -= 30;

    // --- ACCIONES PRIORITARIAS ---
    checkPageBreak(100);
    page.drawText("Acciones Prioritarias", {
      x: margin,
      y: yPos,
      size: 16,
      font: boldFont,
      color: COLORS.danger,
    });
    yPos -= 25;

    const actionW = (contentWidth - 20) / 2;

    for (let i = 0; i < diagnosis.priorityFixes.length; i++) {
      const isLeft = i % 2 === 0;
      // If left, we decide row height based on pair.
      if (isLeft) {
        let maxH = getActionCardHeight(
          diagnosis.priorityFixes[i],
          actionW,
          regularFont
        );
        if (i + 1 < diagnosis.priorityFixes.length) {
          const nextH = getActionCardHeight(
            diagnosis.priorityFixes[i + 1],
            actionW,
            regularFont
          );
          maxH = Math.max(maxH, nextH);
        }

        checkPageBreak(maxH + 20);

        drawPriorityCard(
          page,
          diagnosis.priorityFixes[i],
          margin,
          yPos,
          actionW,
          maxH,
          boldFont,
          regularFont
        );

        if (i + 1 < diagnosis.priorityFixes.length) {
          drawPriorityCard(
            page,
            diagnosis.priorityFixes[i + 1],
            margin + actionW + 20,
            yPos,
            actionW,
            maxH,
            boldFont,
            regularFont
          );
        }
        yPos -= maxH + 20;
      }
    }

    yPos -= 20;

    // --- PLAN DE MEJORA ---
    // Stacked for safety
    drawListInternal(
      "Plan de Mejora",
      diagnosis.recommendations,
      margin,
      contentWidth,
      COLORS.accent
    );
    yPos -= 30;

    // --- SUGERENCIA DE CARTELERÍA ---
    const signageText = diagnosis.suggestedSignageText || "No se generó texto.";
    const signageH =
      getTextHeight(signageText, contentWidth - 30, italicFont, 12, 18) + 60;

    checkPageBreak(signageH);

    page.drawText("Sugerencia de Cartelería", {
      x: margin,
      y: yPos,
      size: 14,
      font: boldFont,
      color: COLORS.purple,
    });

    drawSignageBox(
      page,
      signageText,
      margin,
      yPos - 25,
      contentWidth,
      italicFont
    );

    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer as ArrayBuffer;
  } catch (error) {
    console.error("Failed to generate PDF", error);
    throw new Error("No se pudo generar el reporte PDF");
  }
}

// --- HELPER FUNCTIONS ---

function drawCard(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  color = COLORS.card
) {
  // Simple rectangle, no rounded corners, no borders
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: color,
  });
}

function drawScoreRing(
  page: PDFPage,
  x: number,
  y: number,
  score: number,
  boldFont: PDFFont,
  regularFont: PDFFont
) {
  const size = 40;
  const status = score < 40 ? "Crítico" : score < 70 ? "Regular" : "Excelente";
  const statusColor =
    score < 40 ? COLORS.danger : score < 70 ? COLORS.warning : COLORS.success;

  // Background Circle
  page.drawCircle({
    x,
    y,
    size,
    borderColor: rgb(0.1, 0.15, 0.25),
    borderWidth: 5,
  });

  // Active Arc
  page.drawCircle({
    x,
    y,
    size,
    borderColor: statusColor,
    borderWidth: 3,
    opacity: 0.5,
  });

  page.drawText(score.toString(), {
    x: x - boldFont.widthOfTextAtSize(score.toString(), 24) / 2,
    y: y - 8,
    size: 24,
    font: boldFont,
    color: COLORS.primaryText,
  });

  page.drawText("PUNTAJE GENERAL", {
    x: x + 55,
    y: y + 10,
    size: 7,
    font: regularFont,
    color: COLORS.secondaryText,
  });

  page.drawText(status, {
    x: x + 55,
    y: y - 10,
    size: 14,
    font: boldFont,
    color: statusColor,
  });
}

function drawSummaryBox(
  page: PDFPage,
  text: string,
  y: number,
  x: number,
  w: number,
  font: PDFFont
): number {
  const padding = 20;
  const wrapped = wrapText(text, w - 2 * padding, font, 11);
  const h = wrapped.length * 16 + 2 * padding;

  drawCard(page, x, y - h, w, h);

  let ty = y - padding - 11;
  for (const line of wrapped) {
    page.drawText(line, {
      x: x + padding,
      y: ty,
      size: 11,
      font: font,
      color: COLORS.secondaryText,
    });
    ty -= 16;
  }
  return y - h;
}

function drawSpecCard(
  page: PDFPage,
  title: string,
  text: string,
  x: number,
  y: number,
  w: number,
  boldFont: PDFFont,
  regularFont: PDFFont,
  accentColor: RGB
) {
  const padding = 15;
  const wrapped = wrapText(text, w - 2 * padding, regularFont, 9);
  const h = wrapped.length * 13 + 55;

  drawCard(page, x, y - h, w, h);

  // Header with "icon" (colored square)
  page.drawRectangle({
    x: x + padding,
    y: y - 25,
    width: 8,
    height: 8,
    color: accentColor,
  });
  page.drawText(title, {
    x: x + padding + 15,
    y: y - 24,
    size: 9,
    font: boldFont,
    color: COLORS.primaryText,
  });

  let ty = y - 45;
  for (const line of wrapped) {
    page.drawText(line, {
      x: x + padding,
      y: ty,
      size: 9,
      font: regularFont,
      color: COLORS.secondaryText,
    });
    ty -= 13;
  }
}

function drawPriorityCard(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  boldFont: PDFFont,
  regularFont: PDFFont
) {
  const padding = 12;
  const wrapped = wrapText(text, w - 2 * padding, regularFont, 9);

  drawCard(page, x, y - h, w, h, rgb(0.12, 0.05, 0.05)); // Dark red card

  page.drawText("ACCIÓN RECOMENDADA", {
    x: x + padding,
    y: y - padding - 8,
    size: 7,
    font: boldFont,
    color: rgb(1, 0.4, 0.4),
  });

  let ty = y - padding - 22;
  for (const line of wrapped) {
    page.drawText(line, {
      x: x + padding,
      y: ty,
      size: 9,
      font: regularFont,
      color: rgb(1, 0.8, 0.8),
    });
    ty -= 12;
  }
}

function drawSignageBox(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  w: number,
  font: PDFFont
) {
  const padding = 15;
  const wrapped = wrapText(text, w - 2 * padding, font, 12);
  const h = wrapped.length * 18 + 2 * padding;

  drawCard(page, x, y - h, w, h, rgb(0.08, 0.05, 0.12)); // Dark purple box

  let ty = y - padding - 12;
  for (const line of wrapped) {
    page.drawText(line, {
      x: x + padding,
      y: ty,
      size: 12,
      font: font,
      color: COLORS.primaryText,
    });
    ty -= 18;
  }
}

// --- UTILS ---

function wrapText(
  text: string,
  width: number,
  font: PDFFont,
  size: number
): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const lineWithWord = `${currentLine} ${word}`;
    if (font.widthOfTextAtSize(lineWithWord, size) < width) {
      currentLine = lineWithWord;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

function getTextHeight(
  text: string,
  w: number,
  font: PDFFont,
  size: number,
  lineH: number
) {
  const wrapped = wrapText(text, w, font, size);
  return wrapped.length * lineH;
}

function getActionCardHeight(text: string, w: number, font: PDFFont) {
  const padding = 12;
  const wrapped = wrapText(text, w - 2 * padding, font, 9);
  return wrapped.length * 12 + 22 + 12 + 10; // Padding top + Title + Text + Padding bottom
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
