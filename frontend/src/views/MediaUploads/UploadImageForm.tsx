import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";

import CustomFileInputField from "../../components/ui/CustomFileInputField";
import Button from "../../components/ui/button";
import api from "../../utils/axios";
import { server_base_endpoints } from "../../utils/server_base_endpoints";
import type { MultipleUploadImageResponse, SelectedImage } from "./types";

interface UploadImageFormProps {
  selectedImages: SelectedImage[];
  onFilesSelected: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
  onUploadSuccess: (uploadedIds: string[]) => void;
}

const UploadImageForm = ({
  selectedImages,
  onFilesSelected,
  onUploadSuccess,
}: UploadImageFormProps) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (selectedImages.length === 0) {
      toast.warning("Please select at least one image.");
      return;
    }

    try {
      setIsUploading(true);

      const formData = new FormData();

      selectedImages.forEach(({ file }) => {
        formData.append("images", file);
      });

      const res = await api.post<MultipleUploadImageResponse>(
        server_base_endpoints.media.upload_multiple_img,
        formData,
      );

      if (res.data.success && res.data.images?.length) {
        toast.success(res.data.message);

        onUploadSuccess(selectedImages.map((image) => image.id));
      }
    } catch (error: unknown) {
      console.error("Image upload error:", error);

      if (axios.isAxiosError(error)) {
        toast.error(
          error.response?.data?.message || "Error while uploading images.",
        );
      } else {
        toast.error("Something went wrong.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-[#0A0A0A]">Upload Images</h2>

        <p className="mt-1 text-sm text-gray-500">
          Select images to add them to your memories.
        </p>
      </div>

      <div className="space-y-4">
        <CustomFileInputField
          label="Choose Images"
          accept="image/jpeg,image/png,image/webp"
          multiple={true}
          onChange={onFilesSelected}
        />

        {selectedImages.length > 0 && (
          <p className="text-sm text-gray-500">
            {selectedImages.length} image(s) selected
          </p>
        )}

        <Button
          fullWidth
          disabled={selectedImages.length === 0 || isUploading}
          onClick={handleUpload}
        >
          {isUploading ? "Uploading..." : "Upload Images"}
        </Button>
      </div>
    </div>
  );
};

export default UploadImageForm;
