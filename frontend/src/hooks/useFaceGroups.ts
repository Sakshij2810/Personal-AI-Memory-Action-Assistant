// frontend/src/hooks/useFaceGroups.ts
import { useQuery } from "@tanstack/react-query";
import { fetchFaceGroups } from "../apis/face-groups.api";

export const useFaceGroups = (minSimilarity = 0.45) => {
  return useQuery({
    queryKey: ["face-groups", minSimilarity],
    queryFn: () => fetchFaceGroups(minSimilarity),
    retry: false,
    staleTime: 30_000,
  });
};
