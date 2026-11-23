# Face Service — Setup Guide

## 1. Environment

Development environment used:

| Component             | Version                        |
| --------------------- | ------------------------------ |
| Machine               | MacBook Air M4 (Apple Silicon) |
| Architecture          | arm64                          |
| Python                | 3.11.11                        |
| OpenCV                | 5.1.0                          |
| opencv-contrib-python | 5.1.0.95                       |
| NumPy                 | 2.4.6                          |

**Why Python 3.11?**

We selected Python 3.11 as our compatibility baseline for the face-processing libraries.

## 2. Create the Python Service

From the project root:

```bash
mkdir face-service
cd face-service
```

Create a Python virtual environment:

```bash
python3.11 -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate
```

Verify Python:

```bash
python --version
```

Expected:

```text
Python 3.11.11
```

## 3. Install OpenCV

Install OpenCV with its additional modules:

```bash
pip install opencv-contrib-python
```

We use `opencv-contrib-python` because it includes the additional face-processing APIs required by our implementation.

Verify the installed versions:

```bash
pip show opencv-contrib-python
pip show numpy
```

Check OpenCV:

```bash
python -c "import cv2; print(cv2.__version__)"
```

Expected:

```text
5.1.0
```

Verify the required APIs:

```bash
python -c "import cv2; print(hasattr(cv2, 'FaceDetectorYN')); print(hasattr(cv2, 'FaceRecognizerSF'))"
```

Expected:

```text
True
True
```

## 4. Create the Models Directory

```bash
mkdir models
```

Our face service uses two ONNX models:

| Model | Responsibility                      |
| ----- | ----------------------------------- |
| YuNet | Detects faces and their locations   |
| SFace | Generates numerical face embeddings |

### Model files

Place the following files inside `models/`:

- `face_detection_yunet_2023mar.onnx`
- `face_recognition_sface_2021dec.onnx`

Directory structure:

```text
face-service/
├── .venv/
├── models/
│   ├── face_detection_yunet_2023mar.onnx
│   └── face_recognition_sface_2021dec.onnx
└── test_models.py
```

## 5. Test Model Loading

Create the file:

```bash
touch test_models.py
```

Add the following code:

```python
import cv2

# Load the YuNet face detection model
detector = cv2.FaceDetectorYN.create(
    "models/face_detection_yunet_2023mar.onnx",
    "",
    (320, 320)
)

# Load the SFace face recognition model
recognizer = cv2.FaceRecognizerSF.create(
    "models/face_recognition_sface_2021dec.onnx",
    ""
)

print("YuNet loaded successfully!")
print("SFace loaded successfully!")
```

Run the test:

```bash
python test_models.py
```

Expected output:

```text
YuNet loaded successfully!
SFace loaded successfully!
```

**Result:** Both ONNX models loaded successfully using OpenCV.

Note: OpenCV may display a backend warning about unsupported targets. We observed this warning during testing, but it did not prevent model loading or face detection.

## 6. Final Setup Structure

```text
Personal AI Memory & Action Assistant/
├── backend/
├── frontend/
├── face-service/
│   ├── .venv/
│   ├── models/
│   │   ├── face_detection_yunet_2023mar.onnx
│   │   └── face_recognition_sface_2021dec.onnx
│   └── test_models.py
└── R&D/
```

## 7. Important Notes

- Python dependencies are isolated inside `.venv`.
- Model files are stored locally; no API key or paid inference service is required.
- Do not commit `.venv` to Git.
- Keep model files and their license notices with the project.
- We have verified model loading. Actual face detection was tested separately using `detect_faces.py`.

**Current milestone:** Python environment configured, OpenCV installed, and YuNet/SFace model loading verified.
