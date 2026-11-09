
import math


def calculate_angle(a, b, c):
    """세 관절의 2차원 좌표로 중심 관절의 각도를 계산합니다."""
    ab = (a["x"] - b["x"], a["y"] - b["y"])
    cb = (c["x"] - b["x"], c["y"] - b["y"])

    norm_ab = math.hypot(*ab)
    norm_cb = math.hypot(*cb)

    if norm_ab == 0 or norm_cb == 0:
        return None

    cosine = (
        ab[0] * cb[0] + ab[1] * cb[1]
    ) / (norm_ab * norm_cb)

    cosine = max(-1.0, min(1.0, cosine))
    return round(math.degrees(math.acos(cosine)), 2)


def analyze_pose(landmarks):
    """오른팔 펴기 예시 자세를 판정합니다."""
    required = ("12", "14", "16")

    if any(key not in landmarks for key in required):
        return {
            "status": "not_detected",
            "feedback": "필요한 관절이 인식되지 않았습니다.",
            "angle": None,
        }

    shoulder = landmarks["12"]
    elbow = landmarks["14"]
    wrist = landmarks["16"]

    joints = (shoulder, elbow, wrist)

    if any(
        joint.get("visibility", 0) < 0.5
        for joint in joints
    ):
        return {
            "status": "not_detected",
            "feedback": "오른팔이 잘 보이도록 위치를 조정해 주세요.",
            "angle": None,
        }

    angle = calculate_angle(shoulder, elbow, wrist)

    if angle is None:
        return {
            "status": "not_detected",
            "feedback": "관절 각도를 계산할 수 없습니다.",
            "angle": None,
        }

    if angle >= 160:
        return {
            "status": "correct",
            "feedback": "자세가 아주 좋습니다! 유지하세요.",
            "angle": angle,
        }

    return {
        "status": "incorrect",
        "feedback": "오른쪽 팔을 조금 더 펴주세요!",
        "angle": angle,
    }
