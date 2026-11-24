import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeFaceFromPerson } from "../apis/face-groups.api";

interface RemoveFaceInput {
  personId: string;
  faceId: string;
  sourceFaceCount: number;
}

export const useRemoveFace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ personId, faceId }: RemoveFaceInput) =>
      removeFaceFromPerson(personId, faceId),

    onSuccess: async (_data, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: ["people"],
        }),
      ];

      if (variables.sourceFaceCount > 1) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: ["person-gallery", variables.personId],
          }),
        );
      }

      await Promise.all(invalidations);
    },
  });
};
