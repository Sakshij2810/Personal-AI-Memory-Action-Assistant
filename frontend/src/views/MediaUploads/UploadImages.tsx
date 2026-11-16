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
import type { SelectedImage } from "./types";

interface UploadImagesProps {
  user: User;
  setUser: Dispatch<SetStateAction<User | null>>;
}

const UploadImages = ({ user, setUser }: UploadImagesProps) => {
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const objectUrls = useRef(new Set<string>());
  /*
   useRef ->  stores a value that persists between React renders.
   Why combine useRef and Set?  -> Because you want to remember every generated preview URL so that you can clean them up later.
   */

  // cleanup function revokes any remaining URLs
  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      /*
      URL.revokeObjectURL -> When you no longer need the preview, use this 
      This tells the browser that the temporary object URL can be released.


      Consider this example:
1. User selects photo1.jpg.
2. You generate blob:url-1.
3. User selects photo2.jpg.
4. You generate blob:url-2.
5. User removes photo1.jpg.
6. You revoke blob:url-1 and remove it from the Set.
7. User leaves the upload page.
8. Your cleanup function revokes any remaining URLs.

      */
      objectUrls.current.clear();
    };
  }, []);

  // handle images selection
  const handleFilesSelected = (files: File[]) => {
    const newImages: SelectedImage[] = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      /*
       URL.createObjectURL -> (blob:http://localhost:5173/8a7f3c2e-1234-4567-890a-abcdef123456) 
       creates a temporary URL that allows the browser to display a local file, such as an image, without uploading it to your backend.
       */

      objectUrls.current.add(previewUrl);

      return {
        id: crypto.randomUUID(),
        file,
        previewUrl,
      };
    });

    setSelectedImages((previous) => [...previous, ...newImages]);
  };

  // remove selected image
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

  // handle upload success
  /*
 1. Identify which selected images were successfully uploaded.
 2. Clean up their temporary preview URLs.
 3. Remove those images from the upload preview UI.
 4. Keep images that were not uploaded successfully.
   */
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
