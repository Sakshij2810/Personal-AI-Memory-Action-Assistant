
import cv2
import numpy as np

from pathlib import Path
from threading import Lock

from fastapi import FastAPI, File, HTTPException, UploadFile


# Initialize FastAPI application
app = FastAPI(
    title="Memora AI Face Service",
    description="Face detection and embedding generation service",
    version="1.0.0"
)

# Model file paths
BASE_DIR = Path(__file__).resolve().parent

DETECTION_MODEL = (
    BASE_DIR / "models" / "face_detection_yunet_2023mar.onnx"
)

RECOGNITION_MODEL = (
    BASE_DIR / "models" / "face_recognition_sface_2021dec.onnx"
)

MAX_IMAGE_SIZE = 20 * 1024 * 1024  # 20 MB

# Load YuNet face detector once
detector = cv2.FaceDetectorYN.create(
    str(DETECTION_MODEL),
    "",
    (320, 320),
    0.8,
    0.3,
    5000
)

# Load SFace recognizer once
recognizer = cv2.FaceRecognizerSF.create(
    str(RECOGNITION_MODEL),
    ""
)

# Protect shared OpenCV model instances during concurrent requests
model_lock = Lock()


def extract_face_embeddings(image_bytes):
    # Convert uploaded bytes into an OpenCV image
    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Invalid or unsupported image")

    height, width = image.shape[:2]

    with model_lock:
        # Configure detector for the uploaded image
        detector.setInputSize((width, height))

        # Detect faces
        _, faces = detector.detect(image)

        results = []

        if faces is None:
            return results

        for index, face in enumerate(faces, start=1):
            # Align and crop detected face
            aligned_face = recognizer.alignCrop(image, face)

            # Generate 128-dimensional face embedding
            embedding = recognizer.feature(aligned_face)

            # Extract bounding box and detection confidence
            x, y, box_width, box_height = face[:4]
            confidence = float(face[-1])

            results.append({
                "face_number": index,
                "bounding_box": {
                    "x": float(x),
                    "y": float(y),
                    "width": float(box_width),
                    "height": float(box_height)
                },
                "detection_confidence": confidence,
                "embedding": embedding.flatten().tolist()
            })

    return results


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "face-service"
    }


@app.post("/face-embeddings")
def generate_face_embeddings(file: UploadFile = File(...)):
    # Validate uploaded file type
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp"
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WEBP images are supported"
        )

    # Read uploaded image
    image_bytes = file.file.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty"
        )

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image size exceeds 20 MB"
        )

    try:
        # Detect faces and generate embeddings
        faces = extract_face_embeddings(image_bytes)

        return {
            "success": True,
            "filename": file.filename,
            "total_faces": len(faces),
            "faces": faces
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Face processing failed"
        )

    finally:
        file.file.close()
