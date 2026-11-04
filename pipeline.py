"""
전체 동작인식 처리 과정

  웹캠(영상 촬영)
    → OpenCV 영상 입력 (프레임 캡처, BGR→RGB 변환)
    → MediaPipe Pose (자세 추론)
    → 신체 Landmark 인식 (33개)
    → 관절 좌표 추출 (타겟 12개 관절의 x, y, z, visibility)
    → 자세판정 파트(2번 역할)로 전달 (NumPy 배열 / JSON)

자세판정 파트에서는 아래처럼 받아 쓰면 됩니다.

    from pipeline import MotionPipeline
    for frame, joints, data in MotionPipeline(source=0).run():
        # joints: (12, 4) np.ndarray,  data: dict(JSON)
        ...
"""
import cv2

import config
import landmark_extractor as le
from pose_detector import PoseDetector


class MotionPipeline:
    def __init__(self, source=0, width=None, height=None, mirror=True):
        """
        source : 0(기본 웹캠), 1, ... 또는 비디오 파일 경로
        mirror : 웹캠일 때 좌우 반전(거울 모드)
        """
        self.source = source
        self.width = width
        self.height = height
        self.mirror = mirror and isinstance(source, int)

    def _open_capture(self):
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            raise RuntimeError(f"영상 소스를 열 수 없습니다: {self.source}")
        if self.width:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        if self.height:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        return cap

    def run(self):
        """프레임마다 (frame_bgr, joints(12,4), data(dict)) 를 내보내는 제너레이터."""
        cap = self._open_capture()
        try:
            with PoseDetector(video_mode=True) as detector:
                while True:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    if self.mirror:
                        frame = cv2.flip(frame, 1)
                    h, w = frame.shape[:2]

                    landmarks = detector.detect(frame)
                    joints = le.extract_target_joints(landmarks)
                    data = le.to_dict(joints, frame_size=(w, h))
                    yield frame, joints, data
        finally:
            cap.release()


def draw_joints(frame, joints, threshold=config.VISIBILITY_THRESHOLD):
    """타겟 관절과 뼈대를 프레임 위에 그림 (확인용)."""
    if joints is None or (joints != joints).all():  # 전부 NaN
        return frame
    h, w = frame.shape[:2]
    px = le.to_pixel(joints, w, h).astype(int)
    vis = le.visible_mask(joints, threshold)
    idx = {n: i for i, n in enumerate(config.TARGET_JOINT_NAMES)}

    for a, b in config.TARGET_CONNECTIONS:
        i, j = idx[a], idx[b]
        if vis[i] and vis[j]:
            cv2.line(frame, tuple(px[i]), tuple(px[j]), (255, 255, 255), 2)
    for i, name in enumerate(config.TARGET_JOINT_NAMES):
        color = (0, 220, 0) if vis[i] else (0, 0, 255)  # 보임: 초록, 가려짐: 빨강
        cv2.circle(frame, tuple(px[i]), 6, color, -1)
    return frame
