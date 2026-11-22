import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchImageAnalysis } from "../apis/media-analysis.api";

const POLLING_INTERVAL = 3_000;
const MAX_POLLING_TIME = 2 * 60 * 1_000;

const isAnalysisPending = (status?: string) =>
  status === "pending" || status === "processing";

/*
Image selected
      |
      v
useEffect starts a 2-minute timer
      |
      v
TanStack Query fetches analysis
      |
      v
Is status pending / processing?
      |
   Yes|       No
      |        |
      v        v
Poll every   Stop polling
3 seconds
      |
      v
2-minute timer expires
      |
      v
setTimedOutImageId(imageId)
      |
      v
Stop automatic polling
*/

export const useMediaAnalysis = (imageId: string, enabled: boolean = true) => {
  const [timedOutImageId, setTimedOutImageId] = useState<string | null>(null);
  const [pollingCycle, setPollingCycle] = useState(0);

  // Start a new polling timeout when the image or polling cycle changes.
  useEffect(() => {
    if (!enabled || !imageId) return;

    const timeoutId = window.setTimeout(() => {
      setTimedOutImageId(imageId);
    }, MAX_POLLING_TIME);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [imageId, enabled, pollingCycle]);

  // ------------------------------ useQuery ------------------------------
  const query = useQuery({
    queryKey: ["media-analysis", imageId],

    queryFn: ({ signal }) => fetchImageAnalysis(imageId, signal),

    enabled: enabled && !!imageId,

    // Continue polling while analysis is pending or processing.
    refetchInterval: (query) => {
      const status = query.state.data?.status;

      if (!isAnalysisPending(status)) {
        return false;
      }

      if (timedOutImageId === imageId) {
        return false;
      }

      return POLLING_INTERVAL;
    },
  });

  const isPollingTimedOut = timedOutImageId === imageId;

  // Manually refresh analysis and restart the polling window.
  const refreshAnalysis = useCallback(() => {
    setTimedOutImageId(null);
    setPollingCycle((previous) => previous + 1);

    return query.refetch();
  }, [query.refetch]);

  return {
    ...query,
    isPollingTimedOut,
    refreshAnalysis,
  };
};
