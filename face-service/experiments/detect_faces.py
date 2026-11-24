# /face-service/detect_faces.py

import cv2
import numpy as np

# Read the original photograph
image = cv2.imread("samples/f1.jpg")

if image is None:
    raise ValueError("Could not load image.")

# Keep a separate copy for drawing bounding boxes
display_image = image.copy()

height, width = image.shape[:2]

# Initialize YuNet face detector
detector = cv2.FaceDetectorYN.create(
    "models/face_detection_yunet_2023mar.onnx",
    "",
    (width, height),
    0.8,
    0.3,
    5000
)

# Initialize SFace recognizer
recognizer = cv2.FaceRecognizerSF.create(
    "models/face_recognition_sface_2021dec.onnx",
    ""
)

# Detect faces
_, faces = detector.detect(image)

# Store all generated face embeddings
embeddings = []

if faces is None:
    print("No faces detected.")

else:
    print(f"Detected {len(faces)} face(s).")

    for index, face in enumerate(faces):

        # Extract bounding box and confidence
        x, y, w, h = face[:4]
        confidence = face[-1]

        print(f"\nFace {index + 1}: confidence={confidence:.2f}")

        # Draw bounding box on the copied image
        x, y, w, h = map(int, face[:4])

        cv2.rectangle(
            display_image,
            (x, y),
            (x + w, y + h),
            (0, 255, 0),
            2
        )

        # Align and crop using the original image
        aligned_face = recognizer.alignCrop(image, face)

        # Generate the 128-dimensional embedding
        embedding = recognizer.feature(aligned_face).flatten()

        # Store this face's embedding
        embeddings.append(embedding)

        print(f"Embedding shape: {embedding.shape}")

    # Compare every unique pair of detected faces
    print("\n--- Face Similarity Results ---")

    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):

            # Calculate cosine similarity
            similarity = recognizer.match(
                embeddings[i].reshape(1, -1),
                embeddings[j].reshape(1, -1),
                cv2.FaceRecognizerSF_FR_COSINE
            )

            print(
                f"Face {i + 1} vs Face {j + 1}: "
                f"{similarity:.4f}"
            )

    # Save the annotated photograph
    cv2.imwrite("samples/detected_faces.jpg", display_image)

    print("\nSaved: samples/detected_faces.jpg")
