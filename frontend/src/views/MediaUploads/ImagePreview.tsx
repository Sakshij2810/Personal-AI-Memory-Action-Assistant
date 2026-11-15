import type { SelectedImage } from "./types";

interface ImagePreviewProps {
  selectedImages: SelectedImage[];
  onRemoveImage: (id: string) => void;
}

const ImagePreview = ({ selectedImages, onRemoveImage }: ImagePreviewProps) => {
  if (selectedImages.length === 0) {
    return (
      <div className="flex min-h-64 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-400">
        No image preview available.
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">
        Image Preview ({selectedImages.length})
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {selectedImages.map((image) => (
          <div key={image.id} className="group relative">
            <img
              src={image.previewUrl}
              alt={image.file.name}
              className="h-32 w-full rounded-lg border border-gray-200 object-cover"
            />

            <button
              type="button"
              onClick={() => onRemoveImage(image.id)}
              aria-label={`Remove ${image.file.name}`}
              title="Remove image"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-lg text-white opacity-100 transition hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
            >
              &times;
            </button>

            <p className="mt-1 truncate text-xs text-gray-500">
              {image.file.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImagePreview;
