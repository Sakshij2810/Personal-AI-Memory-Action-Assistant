
import cv2
from pathlib import Path
from itertools import combinations

# Provisional SFace cosine similarity threshold
SIMILARITY_THRESHOLD = 0.363

COLLECTION_DIR = Path("samples/collection")
ALIGNED_DIR = Path("aligned_faces")

SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".webp"}

# Rotate photographs that are sideways
IMAGE_ROTATIONS = {
    "f2.jpg": cv2.ROTATE_90_CLOCKWISE
}

# Load YuNet detector
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

    # Rotate photograph when configured
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

    # Create folder for aligned face crops
    output_dir = ALIGNED_DIR / image_path.stem
    output_dir.mkdir(parents=True, exist_ok=True)

    for index, face in enumerate(faces, start=1):
        # Align and crop face
        aligned_face = recognizer.alignCrop(image, face)

        # Save aligned crop
        crop_path = output_dir / f"face_{index}.jpg"
        cv2.imwrite(str(crop_path), aligned_face)

        # Generate face embedding
        embedding = recognizer.feature(aligned_face)

        embeddings.append(embedding)

    return embeddings


def load_collection():
    # Find all supported photographs
    image_paths = sorted(
        path for path in COLLECTION_DIR.iterdir()
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_FORMATS
    )

    if not image_paths:
        raise ValueError("No photographs found in collection folder")

    all_faces = []

    # Generate embeddings for every detected face
    for image_path in image_paths:
        embeddings = get_embeddings(image_path)

        for face_number, embedding in enumerate(embeddings, start=1):
            all_faces.append({
                "photo": image_path.name,
                "face_number": face_number,
                "embedding": embedding
            })

    return all_faces


def calculate_similarities(all_faces):
    # Store similarity scores between different photographs
    similarities = {}

    # Compare every unique pair of detected faces
    for index_a, index_b in combinations(range(len(all_faces)), 2):
        face_a = all_faces[index_a]
        face_b = all_faces[index_b]

        # Don't compare faces from the same photograph
        if face_a["photo"] == face_b["photo"]:
            continue

        score = recognizer.match(
            face_a["embedding"],
            face_b["embedding"],
            cv2.FaceRecognizerSF_FR_COSINE
        )

        similarities[(index_a, index_b)] = float(score)

    return similarities


def get_similarity(similarities, index_a, index_b):
    # Retrieve a score regardless of pair ordering
    key = tuple(sorted((index_a, index_b)))
    return similarities[key]


def build_candidate_groups(all_faces, similarities):
    # Start with every face in its own group
    groups = [{index} for index in range(len(all_faces))]

    # Process strongest matches first
    sorted_matches = sorted(
        similarities.items(),
        key=lambda item: item[1],
        reverse=True
    )

    for (index_a, index_b), score in sorted_matches:

        if score < SIMILARITY_THRESHOLD:
            break

        # Find the current groups containing both faces
        group_a = next(
            group for group in groups if index_a in group
        )

        group_b = next(
            group for group in groups if index_b in group
        )

        if group_a is group_b:
            continue

        # A group cannot contain two faces from one photograph
        photos_a = {
            all_faces[index]["photo"] for index in group_a
        }

        photos_b = {
            all_faces[index]["photo"] for index in group_b
        }

        if photos_a.intersection(photos_b):
            continue

        # Require every cross-group pair to meet the threshold
        all_pairs_similar = all(
            get_similarity(similarities, a, b)
            >= SIMILARITY_THRESHOLD
            for a in group_a
            for b in group_b
        )

        if all_pairs_similar:
            # Merge the two candidate groups
            merged_group = group_a.union(group_b)

            groups.remove(group_a)
            groups.remove(group_b)

            groups.append(merged_group)

    return groups


def display_groups(groups, all_faces, similarities):
    # Display only groups containing multiple photographs
    candidate_groups = [
        group for group in groups if len(group) > 1
    ]

    print("\n========== GLOBAL FACE GROUPS ==========")

    if not candidate_groups:
        print("No multi-photo candidate groups found.")
    else:
        for group_number, group in enumerate(
            candidate_groups, start=1
        ):
            print(f"\nCandidate Group {group_number}:")

            for index in sorted(group):
                face = all_faces[index]

                print(
                    f"  {face['photo']} - "
                    f"Face {face['face_number']}"
                )

            # Show the weakest pairwise similarity in the group
            pair_scores = [
                get_similarity(similarities, a, b)
                for a, b in combinations(sorted(group), 2)
            ]

            print(
                f"  Minimum pairwise similarity: "
                f"{min(pair_scores):.4f}"
            )

    # Show faces that were not grouped with another photograph
    grouped_indices = set().union(*candidate_groups) if candidate_groups else set()

    ungrouped = [
        index for index in range(len(all_faces))
        if index not in grouped_indices
    ]

    print("\n========== UNGROUPED FACES ==========")

    for index in ungrouped:
        face = all_faces[index]

        print(
            f"{face['photo']} - Face {face['face_number']}"
        )

    print(f"\nTotal detected faces: {len(all_faces)}")
    print(f"Candidate groups: {len(candidate_groups)}")
    print(f"Ungrouped faces: {len(ungrouped)}")


if __name__ == "__main__":
    ALIGNED_DIR.mkdir(parents=True, exist_ok=True)

    # Detect faces and generate embeddings
    all_faces = load_collection()

    print(f"\nTotal faces collected: {len(all_faces)}")

    # Compare all faces across different photographs
    similarities = calculate_similarities(all_faces)

    print(
        f"Total cross-photo comparisons: "
        f"{len(similarities)}"
    )

    # Organize likely matches into conservative groups
    groups = build_candidate_groups(all_faces, similarities)

    # Display candidate groups
    display_groups(groups, all_faces, similarities)

    print("\nGlobal face grouping completed.")
