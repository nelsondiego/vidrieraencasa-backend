import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { buildCombinedPrompt } from "./build-analysis-prompt";

const geminiResponseSchema = z.object({
  score: z.number().min(0).max(100).default(50),
  overallAssessment: z.string().max(500),
  focalPoints: z
    .string()
    .max(500)
    .default("No se pudo analizar los puntos focales."),
  lighting: z.string().max(500).default("No se pudo analizar la iluminación."),
  signage: z.string().max(500).default("No se pudo analizar la cartelería."),
  distribution: z
    .string()
    .max(500)
    .default("No se pudo analizar la distribución."),
  strengths: z.array(z.string()).max(3),
  issues: z.array(z.string()).max(4),
  priorityFixes: z.array(z.string()).max(3),
  recommendations: z.array(z.string()).max(6),
  suggestedSignageText: z.string().max(100),
});

export type GeminiAnalysisResponse = z.infer<typeof geminiResponseSchema>;

function validateGeminiResponse(response: unknown): GeminiAnalysisResponse {
  try {
    return geminiResponseSchema.parse(response);
  } catch (error) {
    console.error("Invalid Gemini response format:", error);
    throw new Error("Invalid response format from Gemini");
  }
}

export async function analyzeImageWithGemini(
  imageBuffer: ArrayBuffer,
  apiKey: string
): Promise<GeminiAnalysisResponse> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
    });

    const prompt = buildCombinedPrompt();

    // Directly use the image buffer without sharp preprocessing
    const imagePart = {
      inlineData: {
        data: Buffer.from(imageBuffer).toString("base64"),
        mimeType: "image/jpeg", // Assuming JPEG or compatible format
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Gemini response:", text);
      throw new Error("Invalid response format from Gemini");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Force score parsing if missing or zero in a suspicious way
    if (typeof parsed.score !== "number") {
      // Try to find a score in the text if it's not in the JSON
      const scoreMatch = text.match(/score["\s:]+(\d+)/i);
      if (scoreMatch) {
        parsed.score = parseInt(scoreMatch[1]);
      } else {
        // Simple heuristic: if overallAssessment is very negative, score is low
        const lowerText = text.toLowerCase();
        if (
          lowerText.includes("caótico") ||
          lowerText.includes("desorden") ||
          lowerText.includes("suciedad")
        ) {
          parsed.score = 25;
        } else if (
          lowerText.includes("atractiva") ||
          lowerText.includes("buena")
        ) {
          parsed.score = 75;
        } else {
          parsed.score = 50;
        }
      }
    }

    return validateGeminiResponse(parsed);
  } catch (error) {
    console.error("Error analyzing image with Gemini:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to analyze image with Gemini");
  }
}
