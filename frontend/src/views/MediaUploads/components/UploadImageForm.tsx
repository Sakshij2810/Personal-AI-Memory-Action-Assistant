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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));

    // Allow selecting the same file again.
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={isUploading}
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiFolder size={16} />
          Browse Images
        </button>

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

        <button
          type="button"
          disabled={selectedImages.length === 0 || isUploading}
          onClick={handleUpload}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
        >
          {isUploading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Uploading...
            </>
          ) : (
            <>
              <FiCheckCircle size={17} />
              Upload{" "}
              {selectedImages.length > 0
                ? `${selectedImages.length} Images`
                : "Images"}
            </>
          )}
        </button>
      </div>
    </section>
  );
};

export default UploadImageForm;
