// frontend/src/hooks/useSplitPerson.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SplitPersonInput } from "../apis/types";
import { splitPerson } from "../apis/face-groups.api";

export const useSplitPerson = (personId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SplitPersonInput) => splitPerson(personId, payload),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["people"],
      });
    },
  });
};
