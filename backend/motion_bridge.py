
from pathlib import Path
import sys
import threading

import cv2
import numpy as np

# 프로젝트 최상위 motion 폴더를 Python 모듈 경로에 추가
ROOT = Path(__file__).resolve().parent.parent
MOTION_DIR = ROOT / "motion"

if str(MOTION_DIR) not in sys.path:
    sys.path.insert(0, str(MOTION_DIR))

from pose_detector import PoseDetector
import landmark_extractor as le
from pose_analyzer import analyze_pose


class MotionBridge:
    def __init__(self):
        self._detector = None
        self._lock = threading.Lock()

    def analyze_frame(self, image_bytes: bytes):
        # 너무 큰 이미지 요청 차단
        if len(image_bytes) > 2 * 1024 * 1024:
            raise ValueError("이미지 크기는 2MB 이하여야 합니다.")

        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError("이미지를 읽을 수 없습니다.")

        if frame.shape[0] > 1080 or frame.shape[1] > 1920:
            raise ValueError("이미지 해상도가 너무 큽니다.")

        # MediaPipe VIDEO 모드는 같은 인식기에 대한 동시 접근 방지
        with self._lock:
            if self._detector is None:
                self._detector = PoseDetector()

            landmarks = self._detector.detect(frame)
            joints = le.extract_target_joints(landmarks)

        status = le.frame_status(joints)
        api_landmarks = le.to_api_landmarks(joints)

        if status["code"] == "no_person":
            result = {
                "status": "not_detected",
                "feedback": status["message"],
                "angle": None,
            }
        else:
            result = analyze_pose(api_landmarks)

        return {
            **result,
            "landmarks": api_landmarks,
            "frame_status": status,
        }

    def close(self):
        with self._lock:
            if self._detector is not None:
                self._detector.close()
                self._detector = None


motion_bridge = MotionBridge()
