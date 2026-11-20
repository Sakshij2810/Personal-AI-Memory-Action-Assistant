// backend/services/ai/providers/gemini.provider.ts

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { env } from "../../../lib/env.js";
import type {
  ImageAnalysisInput,
  ImageAnalysisProvider,
  ImageAnalysisResult,
} from "../types.js";

const imageAnalysisResultSchema = z.object({
  description: z.string().min(1),

  labels: z.array(
    z.object({
      name: z.string().min(1),
      confidence: z.number().min(0).max(1).optional(),
    }),
  ),
});

// Initialize Gemini SDK once.
const gemini = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
  httpOptions: {
    timeout: 60_000, // 60 seconds per attempt
    retryOptions: {
      attempts: 1, // Only one attempt; no automatic retries
    },
  },
});

async function analyzeImage(
  input: ImageAnalysisInput,
): Promise<ImageAnalysisResult> {
  const base64Image = input.imageBuffer.toString("base64"); // converts binary data stored in a Node.js Buffer into a Base64-encoded string.
  /*
  In our Gemini integration, the uploaded image is already available as a Buffer. 
  We encode it into Base64 because Gemini's inline image input accepts image data in that representation along with its MIME type

  Uploaded image
      ↓
Node.js Buffer (binary bytes)
      ↓
.toString("base64")
      ↓
Base64 string
      ↓
Gemini API
  */

  const response = await gemini.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [
      {
        inlineData: {
          mimeType: input.mimeType,
          data: base64Image,
        },
      },
      {
        text: `
    Analyze this image for a personal memory application.

    Return a JSON object with this exact structure:

    {
      "description": "A short factual description of the image",
      "labels": [
        {
          "name": "wedding",
          "confidence": 0.95
        },
        {
          "name": "outdoor",
          "confidence": 0.90
        }
      ]
    }

    Rules:
    - Describe only what is visibly present.
    - Generate relevant scene and activity labels.
    - Do not guess people's identities or relationships.
    - Do not invent locations, dates or names.
    - Confidence must be between 0 and 1.
    - If confidence cannot be meaningfully estimated, omit it.
    - Return valid JSON only.
  `,
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const responseText = response.text;

  if (!responseText) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsedResponse: unknown;

  try {
    parsedResponse = JSON.parse(responseText);
  } catch (error) {
    throw new Error("Gemini returned invalid JSON.");
  }

  return imageAnalysisResultSchema.parse(parsedResponse);
}

// Function-based provider implementation.
export const geminiImageAnalysisProvider: ImageAnalysisProvider = {
  analyzeImage,
};
