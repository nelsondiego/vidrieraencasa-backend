import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { buildCombinedPrompt } from "./build-analysis-prompt";

const geminiResponseSchema = z.object({
  overallAssessment: z.string().max(500),
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
      model: "gemini-flash-latest",
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
