// backend/services/ai/ai.service.ts
// Application-facing service

import { getImageAnalysisProvider } from "./registry.js";
import type {
  ImageAnalysisInput,
  ImageAnalysisResult,
  ProviderName,
} from "./types.js";

const activeImageAnalysisProvider: ProviderName = "gemini";

export const aiService = {
  async analyzeImage(input: ImageAnalysisInput): Promise<ImageAnalysisResult> {
    const provider = getImageAnalysisProvider(activeImageAnalysisProvider);

    return provider.analyzeImage(input);
  },
};

/*
Worker
  |
  | calls
  v
aiService.analyzeImage(imageInput)
  |
  | 1. Finds which provider to use
  v
Registry
  |
  | 2. Returns the registered Gemini provider
  v
geminiImageAnalysisProvider.analyzeImage(imageInput)
  |
  | 3. Sends image to Gemini API
  v
Google Gemini API
  |
  | 4. Returns image analysis
  v
Structured Result
  |
  v
Worker receives the result

*/
