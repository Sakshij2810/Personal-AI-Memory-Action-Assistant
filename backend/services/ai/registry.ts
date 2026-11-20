// backend/services/ai/registry.ts
// Central directory of AI providers : keeps track of available provider implementations and lets us retrieve one.

import { ImageAnalysisProvider, ProviderName } from "./types.js";

const providers = new Map<ProviderName, ImageAnalysisProvider>();

// register Image Analysis Provider
export function registerImageAnalysisProvider(
  name: ProviderName,
  provider: ImageAnalysisProvider,
) {
  if (providers.has(name)) {
    throw new Error(`Provider "${name}" is already registered.`);
  }

  providers.set(name, provider);
}

// get Image Analysis Provider
export function getImageAnalysisProvider(name: ProviderName) {
  const provider = providers.get(name);

  if (!provider) {
    throw new Error(`Provider "${name}" is not registered.`);
  }

  return provider;
}
