"""
관절 좌표 추출 → 자세판정 파트(2번 역할)로 전달할 데이터 생성

파이프라인 중 [관절 좌표 추출] → [자세판정 파트로 전달] 담당.

출력 형식 (두 가지 제공):
  1) NumPy 배열: shape (12, 4)  행 = config.TARGET_JOINT_NAMES 순서
                               열 = [x, y, z, visibility]
  2) JSON(dict):
     {
       "timestamp": 1739...,         # 초 단위
       "detected": true,
       "frame_size": [width, height],
       "joints": {
         "left_shoulder": {"x":0.41, "y":0.32, "z":-0.12, "visibility":0.99},
         ...
       }
     }

좌표 의미:
  x, y       : 프레임 너비/높이 기준 0.0~1.0 정규화 좌표 (좌상단이 (0,0))
  z          : 깊이. 골반 중심을 원점으로 한 상대값, 작을수록 카메라에 가까움
  visibility : 화면에 보이는지에 대한 신뢰도 0.0~1.0
"""
import json
import time

import numpy as np

import config


def extract_all(landmarks) -> np.ndarray:
    """33개 랜드마크 전체 → (33, 4) 배열."""
    return np.array(
        [[lm.x, lm.y, lm.z, lm.visibility if lm.visibility is not None else 0.0]
         for lm in landmarks],
        dtype=np.float32,
    )


def extract_target_joints(landmarks) -> np.ndarray:
    """33개 중 타겟 관절 12개만 → (12, 4) 배열. 감지 실패 시 NaN 배열."""
    if landmarks is None:
        return np.full((len(config.TARGET_JOINT_NAMES), 4), np.nan, dtype=np.float32)
    return extract_all(landmarks)[config.TARGET_JOINT_INDICES]


def to_pixel(joints: np.ndarray, width: int, height: int) -> np.ndarray:
    """정규화 좌표(x, y) → 픽셀 좌표. 반환 shape (N, 2)."""
    return joints[:, :2] * np.array([width, height], dtype=np.float32)


def visible_mask(joints: np.ndarray, threshold: float = config.VISIBILITY_THRESHOLD) -> np.ndarray:
    """visibility가 기준 이상인 관절 True. 자세판정 시 가려진 관절 제외용."""
    return np.nan_to_num(joints[:, 3], nan=0.0) >= threshold


def to_dict(joints: np.ndarray, frame_size=None, timestamp=None) -> dict:
    """(12, 4) 배열 → 자세판정 파트로 넘길 dict(JSON 직렬화 가능)."""
    detected = not np.isnan(joints).all()
    data = {
        "timestamp": timestamp if timestamp is not None else time.time(),
        "detected": bool(detected),
        "frame_size": list(frame_size) if frame_size else None,
        "joints": {},
    }
    if detected:
        for name, row in zip(config.TARGET_JOINT_NAMES, joints):
            data["joints"][name] = {f: round(float(v), 5) for f, v in zip(config.FIELDS, row)}
    return data


def to_json(joints: np.ndarray, frame_size=None, timestamp=None) -> str:
    return json.dumps(to_dict(joints, frame_size, timestamp), ensure_ascii=False)


def from_dict(data: dict) -> np.ndarray:
    """자세판정 파트에서 dict/JSON을 다시 (12, 4) 배열로 복원할 때 사용."""
    if not data.get("detected"):
        return np.full((len(config.TARGET_JOINT_NAMES), 4), np.nan, dtype=np.float32)
    return np.array(
        [[data["joints"][n][f] for f in config.FIELDS] for n in config.TARGET_JOINT_NAMES],
        dtype=np.float32,
    )
