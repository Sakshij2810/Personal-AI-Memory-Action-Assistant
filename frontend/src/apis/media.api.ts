import api from "../utils/axios";
import { server_base_endpoints } from "../utils/server_base_endpoints";
import type { GalleryResponse } from "../views/Storage/types";

export interface DeleteImageResponse {
  success: boolean;
  fileDeleted?: boolean;
  message?: string;
}

// Fetch all gallery images
export const fetchGalleryImages = async (): Promise<GalleryResponse> => {
  const { data } = await api.get<GalleryResponse>(
    server_base_endpoints.media.get_all_images,
  );

  return data;
};

// Delete an image
export const deleteGalleryImage = async (
  imageId: string,
): Promise<DeleteImageResponse> => {
  const { data } = await api.delete<DeleteImageResponse>(
    server_base_endpoints.media.delete_img(imageId),
  );

  return data;
};
