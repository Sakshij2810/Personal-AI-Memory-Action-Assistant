import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { User } from "../../types/user";
import ImagePreview from "./components/ImagePreview";
import UploadImageForm from "./components/UploadImageForm";
import Sidebar from "../Dashboard/components/Sidebar";

export interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface UploadImagesProps {
  user: User;
  setUser: Dispatch<SetStateAction<User | null>>;
}

const UploadImages = ({ user, setUser }: UploadImagesProps) => {
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
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

    setSelectedImages((previous) => [...previous, ...newImages]);
  };

  const handleRemoveImage = (id: string) => {
    const image = selectedImages.find((item) => item.id === id);

    if (image) {
      URL.revokeObjectURL(image.previewUrl);
      objectUrls.current.delete(image.previewUrl);
    }

    setSelectedImages((previous) =>
      previous.filter((image) => image.id !== id),
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

    setSelectedImages((previous) =>
      previous.filter((image) => !uploadedIds.includes(image.id)),
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-[#0A0A0A]">
      <Sidebar user={user} setUser={setUser} />

      <main className="min-w-0 flex-1 p-5 md:p-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-7">
          {/* Upload Section */}
          <UploadImageForm
            selectedImages={selectedImages}
            onFilesSelected={handleFilesSelected}
            onUploadSuccess={handleUploadSuccess}
          />

          {/* Preview Section */}
          <ImagePreview
            selectedImages={selectedImages}
            onRemoveImage={handleRemoveImage}
          />
        </div>
      </main>
    </div>
  );
};

export default UploadImages;
