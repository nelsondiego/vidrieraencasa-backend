import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
  RGB,
} from "pdf-lib";
import * as webp from "@jsquash/webp";
import * as jpeg from "@jsquash/jpeg";

interface DiagnosisData {
  overallAssessment: string;
  strengths: string[];
  issues: string[];
  priorityFixes: string[];
  recommendations: string[];
  suggestedSignageText: string;
}

interface GeneratePDFOptions {
  imageBuffer: ArrayBuffer;
  analysisDate: Date;
  diagnosis: DiagnosisData;
}

/**
 * Generate PDF report for analysis
 *
 * Creates a professional PDF document containing:
 * - Cover page with image
 * - Executive summary
 * - Detailed diagnosis
 * - Action plan
 *
 * @param options - PDF generation options
 * @returns PDF as ArrayBuffer
 */
export async function generateAnalysisPDF(
  options: GeneratePDFOptions
): Promise<ArrayBuffer> {
  const { imageBuffer, analysisDate, diagnosis } = options;

  try {
    const pdfDoc = await PDFDocument.create();
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // --- PAGE 1: PORTADA ---
    let page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const margin = 50;
    const contentWidth = width - 2 * margin;
    let yPosition = height - margin;

    // Header Title
    yPosition -= 20;
    page.drawText("Informe de Análisis de Vidriera", {
      x: margin,
      y: yPosition,
      size: 26,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 30;

    // Subtitle
    page.drawText("Diagnóstico visual y comercial", {
      x: margin,
      y: yPosition,
      size: 16,
      font: regularFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 40;

    // Date & Product Name
    const formattedDate = formatDate(analysisDate);
    page.drawText(`Fecha: ${formattedDate}`, {
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= 20;

    page.drawText("VidrieraEnCasa.com", {
      x: margin,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: rgb(0.2, 0.4, 0.8), // Brand color-ish
    });
    yPosition -= 40;

    // Main Image (Centered and Large)
    try {
      let image;
      let bufferToEmbed = imageBuffer;

      // Attempt to convert WebP to JPEG
      try {
        const imageData = await webp.decode(imageBuffer);
        bufferToEmbed = await jpeg.encode(imageData);
      } catch (e) {
        // Ignore error, assume it's not WebP or decoding failed
        // console.log("Not a WebP image or decode failed", e);
      }

      try {
        // Try JPG first
        image = await pdfDoc.embedJpg(bufferToEmbed);
      } catch (e) {
        // Try PNG if JPG fails
        try {
          image = await pdfDoc.embedPng(bufferToEmbed);
        } catch (e2) {
          console.error("Failed to embed image as JPG or PNG", e2);
          throw new Error("Formato de imagen no soportado");
        }
      }

      const imageAspectRatio = image.width / image.height;
      const maxImageHeight = 400;
      let imageWidth = contentWidth;
      let imageHeight = imageWidth / imageAspectRatio;

      if (imageHeight > maxImageHeight) {
        imageHeight = maxImageHeight;
        imageWidth = imageHeight * imageAspectRatio;
      }

      // Center image
      const xCentered = margin + (contentWidth - imageWidth) / 2;

      page.drawImage(image, {
        x: xCentered,
        y: yPosition - imageHeight,
        width: imageWidth,
        height: imageHeight,
      });
      yPosition -= imageHeight + 20;
    } catch (e) {
      console.error("Failed to embed image", e);
      page.drawText("(Imagen no disponible)", {
        x: margin,
        y: yPosition,
        size: 12,
        font: regularFont,
        color: rgb(0.6, 0.6, 0.6),
      });
      yPosition -= 40;
    }

    // --- PAGE 2: CONTENIDO ---
    page = pdfDoc.addPage([595, 842]);
    yPosition = height - margin;

    // 2. Resumen Ejecutivo (Destacado)
    yPosition = drawWrappedBlock(
      page,
      "Resumen del Diagnóstico",
      diagnosis.overallAssessment,
      yPosition,
      margin,
      contentWidth,
      boldFont,
      regularFont,
      rgb(0.96, 0.96, 0.98), // Light blue-gray bg
      rgb(0.2, 0.2, 0.2)
    );
    yPosition -= 30;

    // 3. Fortalezas
    yPosition = drawListSection(
      page,
      "Fortalezas de la Vidriera",
      "Aspectos que hoy están funcionando correctamente",
      diagnosis.strengths || [],
      yPosition,
      margin,
      contentWidth,
      boldFont,
      regularFont,
      rgb(0.13, 0.55, 0.13), // Green
      "+" // Safe char for strengths
    );
    yPosition -= 30;

    // 4. Áreas que Están Frenando Ventas (Issues)
    // Check page break before starting this section
    if (yPosition < 200) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = height - margin;
    }

    yPosition = drawListSection(
      page,
      "Áreas que Están Frenando Ventas",
      "Puntos críticos que reducen la atracción de clientes",
      diagnosis.issues || [],
      yPosition,
      margin,
      contentWidth,
      boldFont,
      regularFont,
      rgb(0.8, 0.2, 0.2), // Red
      "-" // Safe char for issues
    );
    yPosition -= 30;

    // 5. PRIORIDAD ABSOLUTA (Nuevo - Highlighted)
    // Check page break
    if (yPosition < 250) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = height - margin;
    }

    yPosition = drawPrioritySection(
      page,
      "PRIORIDAD ABSOLUTA: Qué Cambiar Primero",
      "Estos son los cambios de mayor impacto y menor costo",
      diagnosis.priorityFixes || [],
      yPosition,
      margin,
      contentWidth,
      boldFont,
      regularFont
    );
    yPosition -= 30;

    // 6. Plan de Acción Recomendado
    if (yPosition < 250) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = height - margin;
    }

    yPosition = drawListSection(
      page,
      "Plan de Acción Recomendado",
      "Lista de tareas sugeridas para aplicar esta semana",
      diagnosis.recommendations || [],
      yPosition,
      margin,
      contentWidth,
      boldFont,
      regularFont,
      rgb(0.2, 0.4, 0.8), // Blue
      "[ ]" // Checkbox style safe text
    );
    yPosition -= 30;

    // 7. Texto Sugerido para Cartelería
    if (yPosition < 200) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = height - margin;
    }

    page.drawText("Texto Sugerido para Cartelería", {
      x: margin,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 25;

    page.drawText("Texto sugerido para usar en la vidriera:", {
      x: margin,
      y: yPosition,
      size: 11,
      font: regularFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 20;

    // Box for signage
    const signageText = diagnosis.suggestedSignageText
      ? `"${diagnosis.suggestedSignageText}"`
      : "(No se generó texto específico)";

    const wrappedSignage = wrapText(
      signageText,
      contentWidth - 40,
      regularFont,
      14
    ); // Larger font for signage
    const boxHeight = wrappedSignage.length * 20 + 40;

    // Background for signage
    page.drawRectangle({
      x: margin,
      y: yPosition - boxHeight,
      width: contentWidth,
      height: boxHeight,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });

    let signageY = yPosition - 30;
    for (const line of wrappedSignage) {
      // Center text in box
      const textWidth = regularFont.widthOfTextAtSize(line, 14);
      const textX = margin + (contentWidth - textWidth) / 2;

      page.drawText(line, {
        x: textX,
        y: signageY,
        size: 14,
        font: regularFont, // Could be italic if available
        color: rgb(0.2, 0.2, 0.2),
      });
      signageY -= 20;
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer as ArrayBuffer;
  } catch (error) {
    console.error("Failed to generate PDF", error);
    throw new Error("No se pudo generar el reporte PDF");
  }
}

/**
 * Draw a section with title, intro and bullet points
 */
function drawListSection(
  page: PDFPage,
  title: string,
  intro: string,
  items: string[],
  startY: number,
  margin: number,
  pageWidth: number,
  boldFont: PDFFont,
  regularFont: PDFFont,
  titleColor: RGB,
  bulletChar: string
): number {
  let yPosition = startY;

  // Title
  page.drawText(title, {
    x: margin,
    y: yPosition,
    size: 16,
    font: boldFont,
    color: titleColor,
  });
  yPosition -= 20;

  // Intro
  if (intro) {
    page.drawText(intro, {
      x: margin,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= 25;
  }

  // Items
  for (const item of items) {
    const bulletX = margin + 10;
    const textX = margin + 30;
    const maxTextWidth = pageWidth - 40;

    // Draw bullet
    page.drawText(bulletChar, {
      x: bulletX,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: titleColor,
    });

    // Wrap text
    const wrappedLines = wrapText(item, maxTextWidth, regularFont, 11);

    for (const line of wrappedLines) {
      page.drawText(line, {
        x: textX,
        y: yPosition,
        size: 11,
        font: regularFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 18;
    }
    yPosition -= 8; // Spacing between items
  }

  return yPosition;
}

/**
 * Draw the "Priority Fixes" section with special styling
 */
function drawPrioritySection(
  page: PDFPage,
  title: string,
  intro: string,
  items: string[],
  startY: number,
  margin: number,
  pageWidth: number,
  boldFont: PDFFont,
  regularFont: PDFFont
): number {
  let yPosition = startY;

  // Calculate total height needed roughly
  // This is hard to do perfectly without wrapping first, but we assume it fits or we already checked page break.

  // Draw Header
  page.drawText(title, {
    x: margin,
    y: yPosition,
    size: 16,
    font: boldFont,
    color: rgb(0.8, 0.3, 0.0), // Burnt orange
  });
  yPosition -= 20;

  page.drawText(intro, {
    x: margin,
    y: yPosition,
    size: 10,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5),
  });
  yPosition -= 30;

  // Draw Items in a "Card" style
  for (const item of items) {
    const cardPadding = 10;
    const maxTextWidth = pageWidth - 2 * cardPadding;
    const wrappedLines = wrapText(item, maxTextWidth, boldFont, 11); // Bold text for priority
    const cardHeight = wrappedLines.length * 18 + 2 * cardPadding;

    // Card Background
    page.drawRectangle({
      x: margin,
      y: yPosition - cardHeight + cardPadding + 5, // Adjust for text baseline
      width: pageWidth,
      height: cardHeight,
      color: rgb(1, 0.95, 0.9), // Light orange bg
      borderColor: rgb(1, 0.8, 0.6),
      borderWidth: 1,
    });

    // Text
    let textY = yPosition;
    for (const line of wrappedLines) {
      page.drawText(line, {
        x: margin + cardPadding,
        y: textY,
        size: 11,
        font: boldFont,
        color: rgb(0.2, 0.1, 0.0),
      });
      textY -= 18;
    }

    yPosition -= cardHeight + 10;
  }

  return yPosition;
}

/**
 * Draw a wrapped block of text (for Executive Summary)
 */
function drawWrappedBlock(
  page: PDFPage,
  title: string,
  text: string,
  startY: number,
  margin: number,
  width: number,
  boldFont: PDFFont,
  regularFont: PDFFont,
  bgColor: RGB,
  textColor: RGB
): number {
  let yPosition = startY;

  // Title
  page.drawText(title, {
    x: margin,
    y: yPosition,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 25;

  // Content Box
  const padding = 15;
  const textWidth = width - 2 * padding;
  const wrappedLines = wrapText(text || "", textWidth, regularFont, 12);
  const boxHeight = wrappedLines.length * 20 + 2 * padding;

  page.drawRectangle({
    x: margin,
    y: yPosition - boxHeight,
    width: width,
    height: boxHeight,
    color: bgColor,
    // borderRadius: 4, // pdf-lib doesn't support radius easily in drawRectangle, keeping simple
  });

  let textY = yPosition - padding - 10; // -10 for baseline adjustment
  for (const line of wrappedLines) {
    page.drawText(line, {
      x: margin + padding,
      y: textY,
      size: 12,
      font: regularFont,
      color: textColor,
    });
    textY -= 20;
  }

  return yPosition - boxHeight - 20;
}

/**
 * Wrap text to fit within specified width
 */
function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Format date in Spanish
 */
function formatDate(date: Date): string {
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} de ${month} de ${year}`;
}
