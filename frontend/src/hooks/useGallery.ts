import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchGalleryImages, deleteGalleryImage } from "../apis/media.api";

import type { GalleryResponse } from "../views/Storage/types";

const GALLERY_QUERY_KEY = ["gallery-images"];

const POLLING_INTERVAL = 3000;
const MAX_POLLING_TIME = 60_000;

/*
Gallery fetch
     |
     v
Any image uploaded/processing?
     |
   Yes
     |
     v
Start 3-second polling
     |
     v
Fetch updated gallery
     |
     v
Still pending?
   /       \
 Yes        No
  |          |
  v          v
Continue    Stop
  |
  v
2 minutes reached?
  |
 Yes
  |
  v
Stop polling
*/

export const useGallery = () => {
  const queryClient = useQueryClient();

  // Tracks when automatic polling started.
  const pollingStartedAt = useRef<number | null>(null);

  // =========================================
  // FETCH GALLERY IMAGES
  // =========================================

  const galleryQuery = useQuery({
    queryKey: GALLERY_QUERY_KEY,
    queryFn: fetchGalleryImages,

    retry: false,

    refetchInterval: (query) => {
      const images = query.state.data?.images ?? [];

      const hasPendingImages = images.some(
        (image) =>
          image.processing_status === "uploaded" ||
          image.processing_status === "processing",
      );

      // Stop polling if no images are pending.
      if (!hasPendingImages) {
        pollingStartedAt.current = null;
        return false;
      }

      // Start the polling timer.
      if (pollingStartedAt.current === null) {
        pollingStartedAt.current = Date.now();
      }

      // Stop after 2 minutes.
      const elapsedTime = Date.now() - pollingStartedAt.current;

      if (elapsedTime >= MAX_POLLING_TIME) {
        return false;
      }

      // Fetch updated statuses every 3 seconds.
      return POLLING_INTERVAL;
    },
  });

  // =========================================
  // DELETE IMAGE
  // =========================================

  const deleteMutation = useMutation({
    mutationFn: deleteGalleryImage,

    onSuccess: (response, imageId) => {
      if (!response.success) return;

      // Update the existing gallery cache.
      queryClient.setQueryData<GalleryResponse>(
        GALLERY_QUERY_KEY,
        (previousData) => {
          if (!previousData) return previousData;

          return {
            ...previousData,
            images: previousData.images.filter((image) => image.id !== imageId),
          };
        },
      );
    },
  });

  // =========================================
  // MANUAL REFRESH
  // =========================================

  const refreshGallery = () => {
    // Give automatic polling a fresh 2-minute window.
    pollingStartedAt.current = null;

    return galleryQuery.refetch();
  };

  return {
    ...galleryQuery,

    images: galleryQuery.data?.images ?? [],

    refreshGallery,

    deleteImage: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
