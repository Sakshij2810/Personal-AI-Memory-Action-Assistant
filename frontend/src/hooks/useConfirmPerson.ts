// frontend/src/hooks/useConfirmPerson.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { confirmPerson } from "../apis/face-groups.api";
import type { ConfirmPersonInput } from "../apis/types";

export const useConfirmPerson = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ConfirmPersonInput) => confirmPerson(payload),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["face-groups"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["people"],
        }),
      ]);
    },
  });
};
