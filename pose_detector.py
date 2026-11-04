"""
OpenCV 영상 입력 → MediaPipe Pose 추론

파이프라인 중 [OpenCV 영상 입력] → [MediaPipe Pose] → [33개 Landmark 인식] 담당.
MediaPipe 0.10.x Tasks API(PoseLandmarker)를 사용합니다.
(구버전의 mp.solutions.pose 는 최신 MediaPipe에서 제거되었습니다.)
"""
import os
import time
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

import config


def ensure_model(path: str = config.MODEL_PATH, url: str = config.MODEL_URL) -> str:
    """모델 파일(.task)이 없으면 처음 한 번 내려받습니다."""
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        print(f"[PoseDetector] 모델 다운로드 중: {url}")
        urllib.request.urlretrieve(url, path)
        print(f"[PoseDetector] 저장 완료: {path}")
    return path


class PoseDetector:
    """
    프레임(BGR) 한 장을 받아 33개 랜드마크를 반환하는 래퍼.

    사용 예:
        with PoseDetector() as det:
            landmarks = det.detect(frame_bgr)   # 사람 없으면 None
    """

    def __init__(self, model_path: str = config.MODEL_PATH, video_mode: bool = True):
        ensure_model(model_path)
        self.video_mode = video_mode
        options = vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=model_path),
            running_mode=vision.RunningMode.VIDEO if video_mode else vision.RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=config.MIN_DETECTION_CONFIDENCE,
            min_pose_presence_confidence=config.MIN_PRESENCE_CONFIDENCE,
            min_tracking_confidence=config.MIN_TRACKING_CONFIDENCE,
        )
        self._landmarker = vision.PoseLandmarker.create_from_options(options)
        self._t0 = time.monotonic()
        self._last_ts = -1

    @staticmethod
    def to_mp_image(frame_bgr):
        """OpenCV(BGR) → MediaPipe(RGB) 변환. OpenCV와 MediaPipe를 잇는 '다리'."""
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        return mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

    def _timestamp_ms(self) -> int:
        # VIDEO 모드는 단조 증가하는 타임스탬프가 필요
        ts = int((time.monotonic() - self._t0) * 1000)
        if ts <= self._last_ts:
            ts = self._last_ts + 1
        self._last_ts = ts
        return ts

    def detect(self, frame_bgr):
        """
        반환: 33개 NormalizedLandmark 리스트 (각각 x, y, z, visibility, presence)
              사람이 감지되지 않으면 None
        """
        mp_image = self.to_mp_image(frame_bgr)
        if self.video_mode:
            result = self._landmarker.detect_for_video(mp_image, self._timestamp_ms())
        else:
            result = self._landmarker.detect(mp_image)
        if not result.pose_landmarks:
            return None
        return result.pose_landmarks[0]  # 첫 번째 사람

    def close(self):
        self._landmarker.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
