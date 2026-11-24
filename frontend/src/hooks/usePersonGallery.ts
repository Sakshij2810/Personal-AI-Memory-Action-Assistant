// frontend/src/hooks/usePersonGallery.ts

import { useQuery } from "@tanstack/react-query";
import { fetchPersonGallery } from "../apis/face-groups.api";

export const usePersonGallery = (personId: string) => {
  return useQuery({
    queryKey: ["person-gallery", personId],
    queryFn: () => fetchPersonGallery(personId),
    enabled: Boolean(personId),
  });
};
