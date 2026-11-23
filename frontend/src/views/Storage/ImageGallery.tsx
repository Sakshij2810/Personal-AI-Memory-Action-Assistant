import { useState } from "react";

import {
  FiImage,
  FiSearch,
  FiRefreshCw,
  FiTrash2,
  FiEye,
} from "react-icons/fi";

import { toast } from "sonner";

import { statusStyles, type GalleryImage } from "./types";

import Button from "../../components/form/Button";
import CustomInputField from "../../components/form/CustomInputField";

import ImageDetailsPopup from "./components/ImageDetailsPopup";

import { useGallery } from "../../hooks/useGallery";

const ImageGallery = () => {
  // =========================================
  // TANSTACK QUERY
  // =========================================

  const {
    images,
    isPending,
    isError,
    isFetching,
    refreshGallery,
    deleteImage,
    isDeleting,
  } = useGallery();

  // =========================================
  // LOCAL UI STATE
  // =========================================

  const [search, setSearch] = useState("");
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);

  // =========================================
  // IMAGE URL HELPERS
  // =========================================

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const getOriginalImageUrl = (id: string) =>
    `${backendUrl}/api/v1/media/${id}/file`;

  const getThumbnailImageUrl = (id: string) =>
    `${backendUrl}/api/v1/media/${id}/thumbnail`;

  // =========================================
  // FILTER IMAGES
  // =========================================

  const filteredImages = images.filter((image) =>
    image.filename.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedImage = activeImage
    ? (images.find((image) => image.id === activeImage.id) ?? null)
    : null;

  // =========================================
  // HANDLERS
  // =========================================

  // Manual gallery refresh
  const handleRefresh = () => {
    void refreshGallery();
  };

  // Delete image
  const handleDeleteImage = async (image: GalleryImage) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${image.filename}"?`,
    );

    if (!confirmed) return;

    try {
      const response = await deleteImage(image.id);

      if (!response.success) {
        toast.error(response.message || "Unable to delete image.");
        return;
      }

      // Close preview if the deleted image is currently open.
      setActiveImage((previous) =>
        previous?.id === image.id ? null : previous,
      );

      if (response.fileDeleted === false) {
        toast.warning(
          "Image record deleted, but the local file could not be removed.",
        );
      } else {
        toast.success("Image deleted successfully.");
      }
    } catch (error: unknown) {
      console.error("Delete image error:", error);
      toast.error("Unable to delete image.");
    }
  };

  // =========================================
  // RENDER
  // =========================================

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-5 md:p-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Your Memories
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                All your photos, organized in one place.
              </p>
            </div>

            <Button onClick={handleRefresh} disabled={isFetching}>
              <FiRefreshCw className={isFetching ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>

          {/* Search and count */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <FiSearch
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <CustomInputField
                value={search}
                onChange={setSearch}
                placeholder="Search images by filename..."
                className="pl-10"
              />
            </div>

            <p className="text-sm text-gray-500">
              {filteredImages.length} of {images.length} photos
            </p>
          </div>

          {/* Loading skeleton */}
          {isPending && images.length === 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse overflow-hidden rounded-xl bg-white"
                >
                  <div className="aspect-square bg-gray-200" />

                  <div className="space-y-2 p-3">
                    <div className="h-3 w-3/4 rounded bg-gray-200" />
                    <div className="h-3 w-1/2 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {isError && images.length === 0 && (
            <div className="rounded-xl border border-red-100 bg-white p-10 text-center">
              <p className="text-sm text-red-500">
                Unable to load your images.
              </p>

              <button
                onClick={handleRefresh}
                className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isPending && !isError && images.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-20 text-center">
              <FiImage className="mx-auto mb-4 text-4xl text-gray-300" />

              <h2 className="text-lg font-semibold text-gray-800">
                No memories yet
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Upload your first photos to start building your memory library.
              </p>
            </div>
          )}

          {/* No search results */}
          {!isPending &&
            !isError &&
            images.length > 0 &&
            filteredImages.length === 0 && (
              <div className="rounded-xl bg-white p-12 text-center text-sm text-gray-500">
                No images match "{search}".
              </div>
            )}

          {/* Image grid */}
          {images.length > 0 && filteredImages.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredImages.map((image) => (
                <div
                  key={image.id}
                  className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Image preview */}
                  <button
                    type="button"
                    onClick={() => setActiveImage(image)}
                    className="block w-full text-left"
                  >
                    <div className="aspect-square overflow-hidden bg-gray-100">
                      <img
                        src={
                          image.processing_status === "completed"
                            ? getThumbnailImageUrl(image.id)
                            : getOriginalImageUrl(image.id)
                        }
                        alt={image.filename}
                        crossOrigin="use-credentials"
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </div>

                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {image.filename}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(image.uploaded_at).toLocaleDateString()}
                      </p>

                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${
                          statusStyles[image.processing_status]
                        }`}
                      >
                        {image.processing_status === "completed" && (
                          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        )}

                        {image.processing_status === "processing" && (
                          <span className="mr-2 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                        )}

                        {image.processing_status}
                      </span>
                    </div>
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(image)}
                    disabled={isDeleting}
                    title="Delete image"
                    aria-label={`Delete ${image.filename}`}
                    className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-red-500 shadow-md transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <FiTrash2 size={16} />
                  </button>

                  {/* View image details */}
                  <button
                    type="button"
                    onClick={() => setActiveImage(image)}
                    title="View image details"
                    aria-label={`View ${image.filename} details`}
                    className="absolute right-14 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-red-500 shadow-md transition hover:bg-red-500 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <FiEye size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image preview and details popup */}
      {selectedImage && (
        <ImageDetailsPopup
          key={selectedImage.id}
          image={selectedImage}
          isOpen={true}
          onClose={() => setActiveImage(null)}
        />
      )}
    </>
  );
};

export default ImageGallery;
