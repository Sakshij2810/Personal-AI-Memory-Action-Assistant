
import cv2

# Provisional SFace cosine similarity threshold
SIMILARITY_THRESHOLD = 0.363

# Load YuNet face detector once
detector = cv2.FaceDetectorYN.create(
    "models/face_detection_yunet_2023mar.onnx",
    "",
    (320, 320),
    0.8,
    0.3,
    5000
)

# Load SFace recognizer once
recognizer = cv2.FaceRecognizerSF.create(
    "models/face_recognition_sface_2021dec.onnx",
    ""
)


def get_embeddings(image_path, rotate=False):
    # Read photograph
    image = cv2.imread(image_path)

    if image is None:
        raise ValueError(f"Could not load {image_path}")

    # Rotate photograph when required
    if rotate:
        image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)

    height, width = image.shape[:2]
    detector.setInputSize((width, height))

    # Detect faces
    _, faces = detector.detect(image)

    embeddings = []

    if faces is None:
        print(f"No faces found in {image_path}")
        return embeddings

    print(f"{image_path}: detected {len(faces)} faces")

    for face in faces:
        # Align and crop the detected face
        aligned_face = recognizer.alignCrop(image, face)

        # Save aligned crop for visual inspection
        image_name = image_path.split("/")[-1].split(".")[0]
        face_number = len(embeddings) + 1

        cv2.imwrite(
            f"samples/{image_name}_face_{face_number}.jpg",
            aligned_face
        )

        # Generate 128-dimensional face embedding
        embedding = recognizer.feature(aligned_face)
        embeddings.append(embedding)

    return embeddings


def compare_photos(faces_a, faces_b):
    # Calculate similarity between every pair of faces
    results = []

    for i, embedding_a in enumerate(faces_a):
        for j, embedding_b in enumerate(faces_b):
            similarity = recognizer.match(
                embedding_a,
                embedding_b,
                cv2.FaceRecognizerSF_FR_COSINE
            )

            results.append({
                "face_a": i + 1,
                "face_b": j + 1,
                "score": float(similarity)
            })

    # Sort candidates by highest similarity
    results.sort(
        key=lambda result: result["score"],
        reverse=True
    )

    return results


def find_mutual_best_matches(results):
    # Store the best match for each face on both sides
    best_for_a = {}
    best_for_b = {}

    for result in results:
        face_a = result["face_a"]
        face_b = result["face_b"]

        if face_a not in best_for_a:
            best_for_a[face_a] = result

        if face_b not in best_for_b:
            best_for_b[face_b] = result

    mutual_matches = []

    # Keep pairs that select each other as their best match
    for face_a, result in best_for_a.items():
        face_b = result["face_b"]
        reverse_match = best_for_b[face_b]

        if (
            reverse_match["face_a"] == face_a
            and result["score"] >= SIMILARITY_THRESHOLD
        ):
            mutual_matches.append(result)

    return mutual_matches


def display_results(photo_a, photo_b, results):
    print(f"\n--- {photo_a} vs {photo_b}: Top Candidates ---")

    for result in results[:10]:
        print(
            f"{photo_a} Face {result['face_a']} ↔ "
            f"{photo_b} Face {result['face_b']}: "
            f"{result['score']:.4f}"
        )

    matches = find_mutual_best_matches(results)

    print(f"\n--- {photo_a} vs {photo_b}: Mutual Best Matches ---")

    if not matches:
        print("No candidate matches found.")
        return

    for result in matches:
        print(
            f"{photo_a} Face {result['face_a']} ↔ "
            f"{photo_b} Face {result['face_b']}: "
            f"{result['score']:.4f}"
        )


if __name__ == "__main__":
    # Generate embeddings for all three photographs
    faces1 = get_embeddings("samples/f1.jpg")
    faces2 = get_embeddings("samples/f2.jpg", rotate=True)
    faces3 = get_embeddings("samples/f5.webp")

    # Compare the photographs
    f1_f2_results = compare_photos(faces1, faces2)
    f1_f5_results = compare_photos(faces1, faces3)

    # Display top candidates and mutual-best matches
    display_results("F1", "F2", f1_f2_results)
    display_results("F1", "F5", f1_f5_results)
