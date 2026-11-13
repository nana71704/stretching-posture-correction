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


class LandmarkSmoother:
    """
    프레임마다 흔들리는 관절 좌표를 부드럽게 보정 (지수이동평균).
    가만히 있어도 각도가 튀어 판정·유지시간이 끊기는 문제를 줄입니다.
    사람이 사라지면 초기화되어 이전 사람의 좌표가 섞이지 않습니다.
    """

    def __init__(self, alpha: float = config.SMOOTHING_ALPHA):
        self.alpha = alpha
        self._prev = None

    def reset(self):
        self._prev = None

    def update(self, joints: np.ndarray) -> np.ndarray:
        if np.isnan(joints).all():
            self.reset()
            return joints
        if self._prev is None or np.isnan(self._prev).any():
            self._prev = joints.copy()
            return joints
        smoothed = joints.copy()
        smoothed[:, :3] = self.alpha * joints[:, :3] + (1 - self.alpha) * self._prev[:, :3]
        self._prev = smoothed
        return smoothed


def frame_status(joints: np.ndarray, threshold: float = config.VISIBILITY_THRESHOLD) -> dict:
    """
    인식 상태 판정 (예외처리).
      no_person    : 사람이 없음
      out_of_frame : 관절 일부가 화면 밖
      occluded     : 관절 일부가 가려짐(visibility 낮음)
      ok           : 정상
    """
    if np.isnan(joints).all():
        return {"code": "no_person", "message": "사람이 인식되지 않았습니다. 카메라 앞에 서 주세요.",
                "joints": []}
    x, y = joints[:, 0], joints[:, 1]
    outside = (x < 0) | (x > 1) | (y < 0) | (y > 1)
    if outside.any():
        names = [n for n, o in zip(config.TARGET_JOINT_NAMES, outside) if o]
        return {"code": "out_of_frame", "message": "몸 전체가 화면에 들어오도록 뒤로 물러나 주세요.",
                "joints": names}
    hidden = ~visible_mask(joints, threshold)
    if hidden.any():
        names = [n for n, h in zip(config.TARGET_JOINT_NAMES, hidden) if h]
        return {"code": "occluded", "message": "가려진 관절이 있어요. 팔다리가 잘 보이게 서 주세요.",
                "joints": names}
    return {"code": "ok", "message": "", "joints": []}


def to_api_landmarks(joints: np.ndarray) -> dict:
    """
    백엔드 /api/pose/analyze 형식으로 변환.
    키 = MediaPipe 번호 문자열("11"), 값 = {x, y, visibility} (모두 0~1로 제한)
    사람이 없으면 빈 dict.
    """
    if np.isnan(joints).all():
        return {}
    out = {}
    for idx, row in zip(config.TARGET_JOINT_INDICES, joints):
        out[str(idx)] = {
            "x": float(min(1.0, max(0.0, row[0]))),
            "y": float(min(1.0, max(0.0, row[1]))),
            "visibility": float(min(1.0, max(0.0, row[3]))),
        }
    return out


def from_dict(data: dict) -> np.ndarray:
    """자세판정 파트에서 dict/JSON을 다시 (12, 4) 배열로 복원할 때 사용."""
    if not data.get("detected"):
        return np.full((len(config.TARGET_JOINT_NAMES), 4), np.nan, dtype=np.float32)
    return np.array(
        [[data["joints"][n][f] for f in config.FIELDS] for n in config.TARGET_JOINT_NAMES],
        dtype=np.float32,
    )
