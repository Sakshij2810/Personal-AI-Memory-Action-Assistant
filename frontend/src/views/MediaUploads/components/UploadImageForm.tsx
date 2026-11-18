import { useRef, useState, type DragEvent } from "react";
import axios from "axios";

import {
  FiUploadCloud,
  FiImage,
  FiFolder,
  FiCheckCircle,
} from "react-icons/fi";

import { toast } from "sonner";

import api from "../../../utils/axios";
import { server_base_endpoints } from "../../../utils/server_base_endpoints";

import type { MultipleUploadImageResponse, SelectedImage } from "../types";
import CustomFileInputField from "../../../components/form/CustomFileInputField";
import CustomButton from "../../../components/form/Button";

interface UploadImageFormProps {
  selectedImages: SelectedImage[];
  onFilesSelected: (files: File[]) => void;
  onUploadSuccess: (uploadedIds: string[]) => void;
}

const UploadImageForm = ({
  selectedImages,
  onFilesSelected,
  onUploadSuccess,
}: UploadImageFormProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  /*
  - We hide the default HTML file input because we want our own attractive button instead of the browser's default file input UI.
  - But if the input is hidden, how will the user open the file picker?
  - That's where fileInputRef comes in.
   */

  // Validate selected files before passing them to the parent.
  const addFiles = (files: File[]) => {
    const validFiles = files.filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );

    if (validFiles.length !== files.length) {
      toast.warning("Only JPG, PNG and WEBP images are supported.");
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  // Handle files selected through the file picker.
  const handleFileChange = (files: File[]) => {
    addFiles(files);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    /* Allow selecting the same file again.
    The flow is:
1. User selects photo1.jpg → onChange fires.
2. User removes that image from the selected images.
3. User selects photo1.jpg again.
4. By default, the browser may not fire onChange because the input still has the same file selected.
5. So we clear the input using fileInputRef.current.value = "".
6. Now the user can select photo1.jpg again, and onChange fires.
One important point: We clear the file input's selection, not the file stored in React state.
    */
  };

  // Upload selected images to the backend.
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

        // Current API behavior assumes all selected images were uploaded.
        onUploadSuccess(selectedImages.map((image) => image.id));
      } else {
        toast.error(res.data.message || "Image upload failed.");
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

  // Handle drag-and-drop events.
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Don't perform the default action associated with this event. I'll handle it myself.
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    addFiles(Array.from(e.dataTransfer.files));
  };
  return (
    <section className="w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-7">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Upload your memories
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Add photos to your personal memory library.
          </p>
        </div>

        {selectedImages.length > 0 && (
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            {selectedImages.length} selected
          </span>
        )}
      </div>

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
        }`}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
          <FiUploadCloud size={28} className="text-gray-700" />
        </div>

        <h3 className="text-base font-semibold text-gray-800">
          Drag and drop your images here
        </h3>

        <p className="mt-2 text-sm text-gray-500">
          or browse images from your device
        </p>

        {/* Reusable hidden file input */}
        <CustomFileInputField
          inputRef={fileInputRef}
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={isUploading}
          onChange={handleFileChange}
          inputClassName="hidden"
        />

        {/* Reusable button */}
        <CustomButton
          type="button"
          variant="primary"
          size="lg"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="mt-5"
        >
          <FiFolder size={16} />
          Browse Images
        </CustomButton>

        <p className="mt-4 text-xs text-gray-400">
          Supported formats: JPG, JPEG, PNG and WEBP
        </p>
      </div>

      {/* Upload footer */}
      <div className="mt-5 flex flex-col gap-4 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FiImage size={17} />

          <span>
            {selectedImages.length === 0
              ? "No images selected yet"
              : `${selectedImages.length} image(s) ready to upload`}
          </span>
        </div>

        {/* Reusable upload button with built-in loading state */}
        <CustomButton
          type="button"
          variant="primary"
          size="lg"
          disabled={selectedImages.length === 0}
          isLoading={isUploading}
          loadingText="Uploading..."
          onClick={handleUpload}
          className="w-full sm:w-auto"
        >
          <FiCheckCircle size={17} />
          Upload{" "}
          {selectedImages.length > 0
            ? `${selectedImages.length} Images`
            : "Images"}
        </CustomButton>
      </div>
    </section>
  );
};

export default UploadImageForm;
