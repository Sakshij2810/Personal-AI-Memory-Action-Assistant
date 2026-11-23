# Memora AI — Face Service

## 1. Overview

The Face Service is an independent Python-based microservice responsible for detecting human faces in photographs and generating numerical face embeddings.

It is a component of Memora AI's Face Detection & Face Embeddings phase.

Its primary responsibilities are:

- Detect faces in uploaded photographs.
- Extract face bounding boxes and detection confidence scores.
- Align and crop detected faces.
- Generate 128-dimensional face embeddings.
- Return structured results to the Node.js backend through an HTTP API.

The service uses locally hosted computer vision models, so face detection and embedding generation do not require external AI APIs, API keys, or paid inference services.

## 2. Architecture

The Face Service follows a microservice architecture.

```text
                 Memora AI
                     |
                     |
              Node.js Backend
                     |
                     | HTTP Request
                     v
             Python Face Service
                     |
              FastAPI Application
                     |
              Image Processing
                     |
             +-------+-------+
             |               |
             v               v
        YuNet Detector   SFace Recognizer
             |               |
             v               v
        Face Detection   Face Embeddings
             |               |
             +-------+-------+
                     |
                     v
               JSON Response
                     |
                     v
              Node.js Backend
```

### Responsibility separation

| Component           | Responsibility                                                               |
| ------------------- | ---------------------------------------------------------------------------- |
| Node.js backend     | Authentication, application logic, database operations and job orchestration |
| BullMQ workers      | Background job processing                                                    |
| Python Face Service | Face detection, alignment and embedding generation                           |
| YuNet               | Face detection                                                               |
| SFace               | Face feature extraction and embedding generation                             |
| PostgreSQL          | Planned persistence of detected faces and embeddings                         |

Python handles computer vision operations, while Node.js remains responsible for application data and database management.

## 3. Technologies Used

| Technology       | Purpose                              |
| ---------------- | ------------------------------------ |
| Python 3.11      | Face service implementation          |
| FastAPI          | HTTP API framework                   |
| Uvicorn          | ASGI server                          |
| OpenCV           | Image processing and computer vision |
| NumPy            | Image array processing               |
| YuNet            | Face detection model                 |
| SFace            | Face recognition feature extraction  |
| ONNX             | Model file format                    |
| python-multipart | Multipart image uploads              |

### Face Detection — YuNet

YuNet is used to detect faces in photographs.

It provides:

- Face bounding boxes.
- Face detection confidence.
- Facial landmark information used during alignment.

Model file:

`models/face_detection_yunet_2023mar.onnx`

### Face Embedding Generation — SFace

SFace generates a numerical representation of each aligned face.

An embedding is a 128-dimensional numerical vector representing facial features.

For example:

```text
[0.12, -0.34, 0.56, ..., 0.21]
```

These vectors can later be compared using cosine similarity to identify likely matches.

Model file:

`models/face_recognition_sface_2021dec.onnx`

The generated embeddings are numerical representations, not names or identity labels.

## 4. Development and Implementation Steps

### Step 1: Python environment setup

Created a separate `face-service` directory inside the Memora AI repository.

Installed Python 3.11.11 and created an isolated virtual environment.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
```

Installed OpenCV with its contributed modules:

```bash
pip install opencv-contrib-python
```

Verified that the required OpenCV classes were available:

- `cv2.FaceDetectorYN`
- `cv2.FaceRecognizerSF`

### Step 2: Downloaded computer vision models

Created the `models/` directory and downloaded the two ONNX models:

- YuNet face detection model.
- SFace face recognition model.

Created `test_models.py` to verify that both models could load successfully.

### Step 3: Implemented face detection

Created `detect_faces.py`.

Implemented:

1. Reading a photograph using OpenCV.
2. Loading the YuNet detector.
3. Detecting faces.
4. Extracting bounding boxes.
5. Drawing bounding boxes on the original photograph.
6. Saving the detection result for visual inspection.

Initial testing detected six faces in the sample photograph.

### Step 4: Implemented face embeddings

Extended the face processing implementation using SFace.

For every detected face:

1. Used `alignCrop()` to align and crop the face.
2. Used `feature()` to generate its embedding.
3. Stored the resulting 128-dimensional vector in memory.
4. Saved aligned face crops for visual inspection.

### Step 5: Implemented pairwise face comparison

Created `compare_photos.py`.

Implemented cosine similarity using:

```python
recognizer.match(
    embedding_a,
    embedding_b,
    cv2.FaceRecognizerSF_FR_COSINE
)
```

Compared every detected face in one photograph against every face in another photograph.

Introduced a provisional reference similarity threshold of `0.363`.

This threshold is experimental and requires evaluation against representative photographs before production use.

### Step 6: Implemented mutual-best matching

Added logic to identify mutual-best matches.

A pair is considered a mutual-best candidate when:

- Face A selects Face B as its strongest match.
- Face B also selects Face A as its strongest match.
- The similarity score meets the configured threshold.

This reduces ambiguous candidate matches but does not establish a person's identity.

### Step 7: Implemented collection-level comparison

Created `collection_compare.py`.

Instead of manually specifying image pairs, the script:

1. Reads photographs from a collection folder.
2. Detects faces in every photograph.
3. Generates embeddings once per photograph.
4. Compares every unique photograph pair.
5. Identifies mutual-best candidate matches.
6. Displays similarity scores.

For three photographs, the script compares all three unique pairs.

### Step 8: Implemented global face grouping

Created `global_face_groups.py`.

Extended collection-level comparison to group likely matching faces across the entire collection.

Implemented:

- Pairwise similarity calculations.
- Strongest-match-first processing.
- Similarity threshold filtering.
- Same-photograph duplicate restrictions.
- Conservative group merging.
- Minimum pairwise similarity validation.

The grouping prototype avoids merging groups when they contain multiple faces from the same photograph or when any cross-group pair fails the similarity threshold.

Test results:

| Metric                  | Result |
| ----------------------- | -----: |
| Photographs             |      3 |
| Detected faces          |     18 |
| Cross-photo comparisons |    108 |
| Candidate groups        |      6 |
| Ungrouped faces         |      3 |

These groups are candidate matches for review, not confirmed identities.

### Step 9: Converted face processing into a FastAPI service

Created `main.py`.

Moved the face detection and embedding generation functionality into an HTTP service.

The service loads YuNet and SFace once during application startup rather than loading the models for every request.

Implemented a shared model lock to protect the detector and recognizer instances during concurrent requests.

## 5. API Endpoints

The Python service currently exposes two endpoints.

### Health Check

**GET `/health`**

Checks whether the Face Service is running.

Example response:

```json
{
  "status": "healthy",
  "service": "face-service"
}
```

### Face Embeddings

**POST `/face-embeddings`**

Accepts an image through multipart form data.

Request field:

`file`

Supported formats:

- JPEG
- PNG
- WEBP

Maximum upload size: 20 MB.

Processing steps:

1. Validate the uploaded image type and size.
2. Decode the image using OpenCV.
3. Detect faces using YuNet.
4. Align and crop each detected face using SFace.
5. Generate a 128-dimensional embedding.
6. Return the results as JSON.

Example response structure:

```json
{
  "success": true,
  "filename": "f1.jpg",
  "total_faces": 1,
  "faces": [
    {
      "face_number": 1,
      "bounding_box": {
        "x": 120.5,
        "y": 80.2,
        "width": 95.0,
        "height": 95.0
      },
      "detection_confidence": 0.94,
      "embedding": [0.12, -0.34, 0.56]
    }
  ]
}
```

The embedding array contains 128 numerical values. The values above are illustrative.

### Error Handling

The API handles:

- Unsupported image formats — HTTP 400.
- Invalid or empty images — HTTP 400.
- Images exceeding 20 MB — HTTP 413.
- Unexpected processing errors — HTTP 500.

## 6. Running the Face Service

Activate the virtual environment:

```bash
cd face-service
source .venv/bin/activate
```

Start the FastAPI service:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Local endpoints:

- Health: `http://localhost:8000/health`
- API documentation: `http://localhost:8000/docs`
- Face embeddings: `http://localhost:8000/face-embeddings`

FastAPI Swagger documentation can be used to upload photographs and test the endpoint interactively.

## 7. Current Project Structure

```text
face-service/
│
├── .venv/
│
├── models/
│   ├── face_detection_yunet_2023mar.onnx
│   └── face_recognition_sface_2021dec.onnx
│
├── samples/
│   └── collection/
│
├── aligned_faces/
│
├── experiments/
│   ├── test_models.py
│   ├── detect_faces.py
│   ├── compare_photos.py
│   ├── collection_compare.py
│   └── global_face_groups.py
│
└── main.py
```

The files inside `experiments/` contain the standalone prototypes developed while testing detection, embeddings, similarity comparison and global grouping.

`main.py` is the active FastAPI service.

## 8. Current Implementation Status

### Completed

- [x] Python 3.11 environment setup.
- [x] OpenCV installation and verification.
- [x] YuNet and SFace model integration.
- [x] Face detection.
- [x] Face alignment and cropping.
- [x] 128-dimensional face embedding generation.
- [x] Pairwise face similarity comparison.
- [x] Mutual-best candidate matching.
- [x] Collection-level comparison.
- [x] Global candidate face grouping prototype.
- [x] FastAPI service implementation.
- [x] Health-check endpoint.
- [x] Face embeddings endpoint.
- [x] Image format and file-size validation.
- [x] Successful API testing through Swagger.

### Pending

- [ ] Connect the Python service to the Node.js BullMQ face-processing worker.
- [ ] Persist detected faces and embeddings in PostgreSQL.
- [ ] Introduce pgvector for database-level similarity search.
- [ ] Implement reliable processing status and recovery.
- [ ] Integrate candidate face groups into the Memora AI application.
- [ ] Build user-facing face review and confirmation functionality.
- [ ] Evaluate similarity thresholds using representative photographs.
- [ ] Add production configuration, monitoring and deployment.

## 9. Important Design Principles

1. **No automatic identity assignment:** Face embeddings only indicate visual similarity. They do not identify a person's name.

2. **No automatic relationship inference:** Family relationships must never be inferred from facial similarity.

3. **User confirmation:** Candidate groups will eventually be presented to users for review and confirmation.

4. **Privacy:** Original photographs and embeddings should remain within the application's controlled infrastructure.

5. **Separation of responsibilities:** Python handles computer vision; Node.js handles application orchestration and persistence.

6. **Original image processing:** Face detection and embedding generation should use original photographs rather than reduced-quality thumbnails.

## 10. Next Development Milestone

The next milestone is integrating the Face Service with the existing Node.js backend.

The intended workflow:

```text
User uploads photograph
          |
          v
Node.js Backend
          |
          v
BullMQ Face Processing Queue
          |
          v
Face Processing Worker
          |
          | HTTP POST
          v
Python Face Service
          |
          v
Face Detection + Embeddings
          |
          v
JSON Response
          |
          v
Node.js Worker
          |
          v
PostgreSQL + pgvector
```

This will transform the standalone computer vision prototype into an integrated background-processing component of Memora AI.
