import path from "node:path";
import sharp from "sharp";

const resizeImage = async () => {
  try {
    const originalPath = path.resolve(
      process.cwd(),
      "UploadMediaLocalStorage/a37c79ec-250e-43f1-882a-46d2efca6cb6.png",
    );

    const thumbnailPath = path.resolve(
      process.cwd(),
      "UploadMediaThumbnails/a37c79ec-250e-43f1-882a-46d2efca6cb6.webp",
    );

    const result = await sharp(originalPath)
      .resize({
        width: 300,
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);

    console.log("Thumbnail generated successfully!");

    console.log("Output width:", result.width);
    console.log("Output height:", result.height);
    console.log("Output format:", result.format);
    console.log("Output size:", result.size, "bytes");
  } catch (error) {
    console.error("Image resizing failed:", error);
  }
};

resizeImage();
