// backend/services/ai/register.ts
// This file has one responsibility: register the provider implementations when the application starts.
import { geminiImageAnalysisProvider } from "./providers/gemini.provider.js";
import { registerImageAnalysisProvider } from "./registry.js";

// Register available AI providers.
export function registerAIProviders(): void {
  registerImageAnalysisProvider("gemini", geminiImageAnalysisProvider);
}
