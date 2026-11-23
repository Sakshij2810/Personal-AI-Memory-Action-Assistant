
import cv2
from pathlib import Path
from itertools import combinations

# Configuration
SIMILARITY_THRESHOLD = 0.363

COLLECTION_DIR = Path("samples/collection")
ALIGNED_DIR = Path("aligned_faces")

SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".webp"}

# Rotate specific photographs when necessary.
# Add filenames here if other photographs need rotation.
IMAGE_ROTATIONS = {
    "f2.jpg": cv2.ROTATE_90_CLOCKWISE
}

# Load YuNet face detector
detector = cv2.FaceDetectorYN.create(
    "models/face_detection_yunet_2023mar.onnx",
    "",
    (320, 320),
    0.8,
    0.3,
    5000
)

# Load SFace recognizer
recognizer = cv2.FaceRecognizerSF.create(
    "models/face_recognition_sface_2021dec.onnx",
    ""
)


def get_embeddings(image_path):
    # Read photograph
    image = cv2.imread(str(image_path))

    if image is None:
        raise ValueError(f"Could not load {image_path}")

    # Apply configured rotation
    rotation = IMAGE_ROTATIONS.get(image_path.name)

    if rotation is not None:
        image = cv2.rotate(image, rotation)

    height, width = image.shape[:2]
    detector.setInputSize((width, height))

    # Detect faces
    _, faces = detector.detect(image)

    if faces is None:
        print(f"{image_path.name}: no faces detected")
        return []

    print(f"{image_path.name}: detected {len(faces)} faces")

    embeddings = []

    # Create output folder for aligned face crops
    output_dir = ALIGNED_DIR / image_path.stem
    output_dir.mkdir(parents=True, exist_ok=True)

    for index, face in enumerate(faces, start=1):
        # Align and crop face
        aligned_face = recognizer.alignCrop(image, face)

        # Save crop for visual inspection
        crop_path = output_dir / f"face_{index}.jpg"
        cv2.imwrite(str(crop_path), aligned_face)

        # Generate 128-dimensional face embedding
        embedding = recognizer.feature(aligned_face)

        embeddings.append(embedding)

    return embeddings


def compare_photos(faces_a, faces_b):
    # Compare every face from photograph A with photograph B
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


def load_collection():
    # Find supported photographs in the collection folder
    image_paths = sorted(
        path for path in COLLECTION_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_FORMATS
    )

    if not image_paths:
        raise ValueError(
            f"No supported photographs found in {COLLECTION_DIR}"
        )

    print(f"\nFound {len(image_paths)} photographs")

    collection = {}

    # Generate embeddings once for each photograph
    for image_path in image_paths:
        collection[image_path.name] = get_embeddings(image_path)

    return collection


def compare_collection(collection):
    # Generate every unique photograph pair
    photo_pairs = combinations(collection.keys(), 2)

    print("\n========== COLLECTION COMPARISON ==========")

    for photo_a, photo_b in photo_pairs:
        faces_a = collection[photo_a]
        faces_b = collection[photo_b]

        # Skip photographs without detected faces
        if not faces_a or not faces_b:
            continue

        results = compare_photos(faces_a, faces_b)
        mutual_matches = find_mutual_best_matches(results)

        print(f"\n--- {photo_a} vs {photo_b} ---")

        if not mutual_matches:
            print("No candidate matches found.")
            continue

        print("Mutual Best Candidate Matches:")

        for result in mutual_matches:
            print(
                f"Face {result['face_a']} ↔ "
                f"Face {result['face_b']} | "
                f"Similarity: {result['score']:.4f}"
            )


if __name__ == "__main__":
    ALIGNED_DIR.mkdir(parents=True, exist_ok=True)

    # Load photographs and generate their embeddings
    collection = load_collection()

    # Compare all unique photograph pairs
    compare_collection(collection)

    print("\nCollection comparison completed.")
