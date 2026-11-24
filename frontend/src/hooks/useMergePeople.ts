import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mergePeople } from "../apis/face-groups.api";

interface MergePeopleVariables {
  targetPersonId: string;
  sourcePersonId: string;
}

export const useMergePeople = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetPersonId, sourcePersonId }: MergePeopleVariables) =>
      mergePeople(targetPersonId, { sourcePersonId }),

    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["people"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["person-gallery", variables.targetPersonId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["person-gallery", variables.sourcePersonId],
        }),
      ]);
    },
  });
};
