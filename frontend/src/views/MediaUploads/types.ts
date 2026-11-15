export interface UploadedImage {
  id: string;
  user_id: string;
  filename: string;
  storage_key: string;
  mime_type: string;
  file_size: string;
  uploaded_at: string;
  status: "uploaded" | "failed";
}

export interface MultipleUploadImageResponse {
  success: boolean;
  message: string;
  count: number;
  images: UploadedImage[];
}
export interface SingleUploadImageResponse {
  success: boolean;
  message: string;
  count: number;
  image: UploadedImage;
}

export interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
}
