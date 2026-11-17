import path from "node:path";
import sharp from "sharp";

const inspectImage = async () => {
  try {
    // Path to an existing uploaded image.
    const imagePath = path.resolve(
      process.cwd(),
      "UploadMediaLocalStorage/a37c79ec-250e-43f1-882a-46d2efca6cb6.png",
    );

    // Create a Sharp instance and read image metadata.
    const metadata = await sharp(imagePath).metadata();

    console.log("Image Metadata:");
    console.log("----------------------");

    console.log("Format:", metadata.format);
    console.log("Width:", metadata.width);
    console.log("Height:", metadata.height);
    console.log("File size:", metadata.size);
    console.log("Channels:", metadata.channels);
  } catch (error) {
    console.error("Image inspection failed:", error);
  }
};

inspectImage();
