import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assignFaceToPerson } from "../apis/face-groups.api";

interface MoveFaceInput {
  sourcePersonId: string;
  targetPersonId: string;
  faceId: string;
  sourceFaceCount: number;
}

export const useMoveFace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetPersonId, faceId }: MoveFaceInput) =>
      assignFaceToPerson(targetPersonId, faceId),

    onSuccess: async (_data, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: ["person-gallery", variables.targetPersonId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["people"],
        }),
      ];

      // Don't refetch a source gallery that no longer exists.
      if (variables.sourceFaceCount > 1) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: ["person-gallery", variables.sourcePersonId],
          }),
        );
      }

      await Promise.all(invalidations);
    },
  });
};
