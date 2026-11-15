import { useEffect, useRef, useState } from "react";

import type { User } from "../../types/user";
import ImagePreview from "./ImagePreview";
import UploadImageForm from "./UploadImageForm";

export interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface UploadImagesProps {
  user: User;
}

const UploadImages = ({ user }: UploadImagesProps) => {
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);

  // Track all object URLs so we can release them on unmount.
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    };
  }, []);

  const handleFilesSelected = (files: File[]) => {
    const newImages: SelectedImage[] = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);

      objectUrls.current.add(previewUrl);

      return {
        id: crypto.randomUUID(),
        file,
        previewUrl,
      };
    });

    setSelectedImages((previousImages) => [...previousImages, ...newImages]);
  };

  const handleRemoveImage = (id: string) => {
    const imageToRemove = selectedImages.find((image) => image.id === id);

    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.previewUrl);
      objectUrls.current.delete(imageToRemove.previewUrl);
    }

    setSelectedImages((previousImages) =>
      previousImages.filter((image) => image.id !== id),
    );
  };

  const handleUploadSuccess = (uploadedIds: string[]) => {
    const uploadedImages = selectedImages.filter((image) =>
      uploadedIds.includes(image.id),
    );

    uploadedImages.forEach((image) => {
      URL.revokeObjectURL(image.previewUrl);
      objectUrls.current.delete(image.previewUrl);
    });

    setSelectedImages((previousImages) =>
      previousImages.filter((image) => !uploadedIds.includes(image.id)),
    );
  };
  return (
    <div className="min-h-screen bg-gray-50 p-6 text-[#0A0A0A]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Welcome, {user.display_name ?? "User"}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Start organizing your personal memories.
          </p>
        </div>

        <div className="flex flex-col items-start gap-6 lg:flex-row">
          <div className="w-full flex-1">
            <UploadImageForm
              selectedImages={selectedImages}
              onFilesSelected={handleFilesSelected}
              onRemoveImage={handleRemoveImage}
              onUploadSuccess={handleUploadSuccess}
            />
          </div>

          <div className="w-full flex-1">
            <ImagePreview
              selectedImages={selectedImages}
              onRemoveImage={handleRemoveImage}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadImages;
