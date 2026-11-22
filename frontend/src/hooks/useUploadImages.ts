import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadImages } from "../apis/media.api";

export function useUploadImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadImages,

    onSuccess: async (data) => {
      // Refresh the gallery cache after a successful upload.
      if (data.success && data.images?.length) {
        await queryClient.invalidateQueries({
          queryKey: ["gallery-images"],
        });
      }
    },
  });
}
