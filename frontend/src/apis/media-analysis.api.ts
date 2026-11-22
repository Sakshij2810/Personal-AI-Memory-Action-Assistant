import api from "../utils/axios";
import { server_base_endpoints } from "../utils/server_base_endpoints";

import type {
  ImageAnalysis,
  ImageAnalysisResponse,
} from "../views/Storage/types";

// Fetch AI analysis for a particular image.
export const fetchImageAnalysis = async (
  imageId: string,
  signal?: AbortSignal,
): Promise<ImageAnalysis> => {
  const { data } = await api.get<ImageAnalysisResponse>(
    server_base_endpoints.media.get_analysis(imageId),
    {
      signal,
    },
  );

  return data.analysis;
};
