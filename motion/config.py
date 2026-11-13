"""
동작인식 영상처리 설정값

- MediaPipe Pose가 인식하는 33개 랜드마크 이름/번호
- 프로젝트에서 사용할 핵심 관절(상체: 어깨·팔꿈치·손목 / 하체: 골반·무릎·발목)
"""

import os

# ── MediaPipe Pose 33개 랜드마크 (번호 → 이름) ──────────────────────────
POSE_LANDMARK_NAMES = [
    "nose",
    "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear",
    "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder",      # 11, 12
    "left_elbow", "right_elbow",            # 13, 14
    "left_wrist", "right_wrist",            # 15, 16
    "left_pinky", "right_pinky",
    "left_index", "right_index",
    "left_thumb", "right_thumb",
    "left_hip", "right_hip",                # 23, 24
    "left_knee", "right_knee",              # 25, 26
    "left_ankle", "right_ankle",            # 27, 28
    "left_heel", "right_heel",
    "left_foot_index", "right_foot_index",
]
assert len(POSE_LANDMARK_NAMES) == 33

# ── 프로젝트 타겟 관절 (이름 → MediaPipe 인덱스) ─────────────────────────
# 순서가 곧 출력 NumPy 배열의 행(row) 순서입니다. 자세판정 파트와 공유하세요.
TARGET_JOINTS = {
    # 상체
    "left_shoulder": 11, "right_shoulder": 12,
    "left_elbow": 13,    "right_elbow": 14,
    "left_wrist": 15,    "right_wrist": 16,
    # 하체
    "left_hip": 23,      "right_hip": 24,
    "left_knee": 25,     "right_knee": 26,
    "left_ankle": 27,    "right_ankle": 28,
    "left_foot_index": 31, "right_foot_index": 32,
}
TARGET_JOINT_NAMES = list(TARGET_JOINTS.keys())
TARGET_JOINT_INDICES = list(TARGET_JOINTS.values())

# 출력 배열 열(column) 순서
FIELDS = ["x", "y", "z", "visibility"]

# 화면에 그릴 타겟 관절 간 연결선 (뼈대)
TARGET_CONNECTIONS = [
    ("left_shoulder", "right_shoulder"),
    ("left_shoulder", "left_elbow"), ("left_elbow", "left_wrist"),
    ("right_shoulder", "right_elbow"), ("right_elbow", "right_wrist"),
    ("left_shoulder", "left_hip"), ("right_shoulder", "right_hip"),
    ("left_hip", "right_hip"),
    ("left_hip", "left_knee"), ("left_knee", "left_ankle"),
    ("right_hip", "right_knee"), ("right_knee", "right_ankle"),
    ("left_ankle", "left_foot_index"), ("right_ankle", "right_foot_index"),
]

# ── MediaPipe 모델 설정 ─────────────────────────────────────────────────
# lite(빠름) / full(균형, 기본) / heavy(정확, 느림)
MODEL_VARIANT = "full"
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    f"pose_landmarker_{MODEL_VARIANT}/float16/latest/"
    f"pose_landmarker_{MODEL_VARIANT}.task"
)
# 실행 위치와 관계없이 motion/models/ 에 저장
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models",
                          f"pose_landmarker_{MODEL_VARIANT}.task")

MIN_DETECTION_CONFIDENCE = 0.5
MIN_PRESENCE_CONFIDENCE = 0.5
MIN_TRACKING_CONFIDENCE = 0.5

# visibility가 이 값보다 낮으면 '가려진 관절'로 간주
VISIBILITY_THRESHOLD = 0.5

# 좌표 떨림 보정 강도 (0~1). 클수록 새 프레임 값을 더 많이 반영(덜 부드럽고 반응 빠름)
SMOOTHING_ALPHA = 0.5
