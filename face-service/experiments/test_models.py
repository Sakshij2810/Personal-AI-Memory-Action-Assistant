
import cv2

# Load YuNet face detection model
detector = cv2.FaceDetectorYN.create(
    "models/face_detection_yunet_2023mar.onnx",
    "",
    (320, 320)
)

# Load SFace face recognition model
recognizer = cv2.FaceRecognizerSF.create(
    "models/face_recognition_sface_2021dec.onnx",
    ""
)

print("YuNet loaded successfully!")
print("SFace loaded successfully!")
