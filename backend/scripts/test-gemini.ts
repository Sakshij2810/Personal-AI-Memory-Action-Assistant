import { readFile } from "node:fs/promises";
import path from "node:path";

import { geminiImageAnalysisProvider } from "../services/ai/providers/gemini.provider.js";

async function main() {
  // Get image path from terminal argument.
  const imagePath = process.argv[2];

  if (!imagePath) {
    throw new Error("Please provide an image path.");
  }

  // Identify image MIME type.
  const extension = path.extname(imagePath).toLowerCase();

  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };

  const mimeType = mimeTypes[extension];

  if (!mimeType) {
    throw new Error("Unsupported image format.");
  }

  // Read image into a Node.js Buffer.
  const imageBuffer = await readFile(imagePath);

  console.log("Sending image to Gemini...");

  // Call our provider.
  const result = await geminiImageAnalysisProvider.analyzeImage({
    imageBuffer,
    mimeType,
  });

  console.log("\nGemini analysis result:\n");

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error("Gemini integration test failed:", error);
  process.exitCode = 1;
});
