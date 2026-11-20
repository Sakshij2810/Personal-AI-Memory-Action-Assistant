// backend/services/ai/types.ts
// Shared contracts : Regardless of which AI provider we use, every provider must accept the same input structure and return the same output structure.

export type ProviderName = "groq" | "gemini" | "openai" | "openrouter";

export type ImageAnalysisInput = {
  imageBuffer: Buffer; // We are passing the actual image data, not the image's filesystem path. The provider implementation will handle converting it into the format required by its API.
  mimeType: string;
};

export type ImageLabel = {
  name: string; // represents the suggested label
  confidence?: number; // represents the model's confidence score, when provided.
};

/*
Why is confidence optional (?)?
- Because not every AI provider returns confidence scores for generated labels.
- We should not invent confidence values when a provider doesn't supply them.
- We'll define the expected range as 0 to 1 when confidence is available.
*/

export type ImageAnalysisResult = {
  description: string;
  labels: ImageLabel[];
};

/*
expected output : 
{
  "description": "People standing together at a wedding celebration.",
  "labels": [
    {
      "name": "people",
      "confidence": 0.96
    },
    {
      "name": "wedding",
      "confidence": 0.91
    },
    {
      "name": "indoor"
    },
    {
      "name": "celebration"
    }
  ]
}
*/

export type ImageAnalysisProvider = {
  analyzeImage(input: ImageAnalysisInput): Promise<ImageAnalysisResult>;
};
