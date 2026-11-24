import api from "../utils/axios";
import { server_base_endpoints } from "../utils/server_base_endpoints";
import type { MultipleUploadImageResponse } from "../views/MediaUploads/types";
import type { GalleryResponse } from "../views/Storage/types";
import type { DeleteImageResponse } from "./types";

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

// Upload multiple images to the backend.
export const uploadImages = async (
  formData: FormData,
): Promise<MultipleUploadImageResponse> => {
  const { data } = await api.post<MultipleUploadImageResponse>(
    server_base_endpoints.media.upload_multiple_img,
    formData,
  );

  return data;
};
