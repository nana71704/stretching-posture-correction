import numpy as np

JOINT_INDICES = {
    "NOSE": "0", "LEFT_EAR": "7", "RIGHT_EAR": "8",
    "LEFT_SHOULDER": "11", "RIGHT_SHOULDER": "12",
    "LEFT_ELBOW": "13", "RIGHT_ELBOW": "14",
    "LEFT_WRIST": "15", "RIGHT_WRIST": "16",
    "LEFT_HIP": "23", "RIGHT_HIP": "24",
    "LEFT_KNEE": "25", "RIGHT_KNEE": "26",
    "LEFT_ANKLE": "27", "RIGHT_ANKLE": "28",
}

def get_point(landmarks, joint_name):
    key = JOINT_INDICES.get(joint_name)
    if key and key in landmarks:
        pt = landmarks[key]
        if isinstance(pt, dict):
            if pt.get("visibility", 1.0) < 0.3:
                return None
            return np.array([pt.get("x", 0.0), pt.get("y", 0.0)])
    return None

def calculate_angle(a, b, c):
    if any(p is None for p in [a, b, c]):
        return 0.0
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360.0 - angle
    return angle

def calculate_tilt_angle(p1, p2):
    if any(p is None for p in [p1, p2]):
        return 0.0
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    return np.degrees(np.arctan2(dy, dx))

def evaluate_neck_shoulder_stretch(landmarks):
    r_ear = get_point(landmarks, "RIGHT_EAR")
    l_ear = get_point(landmarks, "LEFT_EAR")
    r_sh = get_point(landmarks, "RIGHT_SHOULDER")
    l_sh = get_point(landmarks, "LEFT_SHOULDER")
    r_el = get_point(landmarks, "RIGHT_ELBOW")
    l_el = get_point(landmarks, "LEFT_ELBOW")
    r_wr = get_point(landmarks, "RIGHT_WRIST")
    l_wr = get_point(landmarks, "LEFT_WRIST")

    if any(p is None for p in [r_sh, l_sh]):
        return {"status": "not_detected", "score": 0, "feedback": "어깨 관절이 감지되지 않았습니다.", "angle": 0}

    # 귀 데이터가 없을 경우 어깨 기울기로 대체하여 에러 방지 (4번 문제 대응)
    if r_ear is not None and l_ear is not None:
        ear_angle = calculate_tilt_angle(r_ear, l_ear)
        shoulder_angle = calculate_tilt_angle(r_sh, l_sh)
        neck_tilt = abs(ear_angle - shoulder_angle)
    else:
        neck_tilt = abs(calculate_tilt_angle(r_sh, l_sh)) * 0.5

    shoulder_diff_y = abs(l_sh[1] - r_sh[1])
    shoulder_width = abs(l_sh[0] - r_sh[0]) + 1e-6
    shoulder_tilt_ratio = shoulder_diff_y / shoulder_width

    r_arm_angle = calculate_angle(r_sh, r_el, r_wr)
    l_arm_angle = calculate_angle(l_sh, l_el, l_wr)

    score = 0
    feedback = []

    if neck_tilt < 12.0:
        return {
            "status": "incorrect",
            "score": 20,
            "feedback": "목이 충분히 기울어지지 않았습니다. 스트레칭 방향으로 고개를 당겨주세요.",
            "angle": round(neck_tilt, 1)
        }

    if 15.0 <= neck_tilt <= 38.0:
        score += 50
    elif neck_tilt > 38.0:
        score += 35
        feedback.append("목을 너무 과도하게 꺾었습니다.")
    else:
        score += 25
        feedback.append("고개를 조금 더 옆으로 기울여주세요.")

    if shoulder_tilt_ratio < 0.08:
        score += 30
    else:
        score += 10
        feedback.append("반대쪽 어깨가 따라 올라가지 않도록 내려주세요.")

    if r_arm_angle > 140.0 or l_arm_angle > 140.0:
        score += 20
    else:
        score += 10
        feedback.append("팔을 더 펴서 자세를 고정하세요.")

    is_correct = score >= 80
    if not feedback:
        feedback.append("아주 좋은 자세입니다!")

    return {
        "status": "correct" if is_correct else "incorrect",
        "score": score,
        "feedback": " ".join(feedback),
        "angle": round(neck_tilt, 1)
    }

def evaluate_upper_body_flexion(landmarks):
    r_sh = get_point(landmarks, "RIGHT_SHOULDER")
    r_el = get_point(landmarks, "RIGHT_ELBOW")
    r_wr = get_point(landmarks, "RIGHT_WRIST")

    if any(p is None for p in [r_sh, r_el, r_wr]):
        return {"status": "not_detected", "score": 0, "feedback": "팔 관절이 감지되지 않았습니다.", "angle": 0}

    arm_angle = calculate_angle(r_sh, r_el, r_wr)
    score = 85 if arm_angle > 150 else 50
    is_correct = score >= 80

    return {
        "status": "correct" if is_correct else "incorrect",
        "score": score,
        "feedback": "팔을 곧게 펴주세요." if not is_correct else "좋은 자세입니다!",
        "angle": round(arm_angle, 1)
    }

def evaluate_squat(landmarks):
    r_hip = get_point(landmarks, "RIGHT_HIP")
    r_knee = get_point(landmarks, "RIGHT_KNEE")
    r_ankle = get_point(landmarks, "RIGHT_ANKLE")

    if any(p is None for p in [r_hip, r_knee, r_ankle]):
        return {"status": "not_detected", "score": 0, "feedback": "하체 관절이 감지되지 않았습니다.", "angle": 0}

    knee_angle = calculate_angle(r_hip, r_knee, r_ankle)
    score = 90 if 70 <= knee_angle <= 110 else 40
    is_correct = score >= 80

    return {
        "status": "correct" if is_correct else "incorrect",
        "score": score,
        "feedback": "무릎을 더 굽혀주세요." if not is_correct else "완벽한 스쿼트 자세입니다!",
        "angle": round(knee_angle, 1)
    }

def analyze_pose(stretch_id, landmarks):
    """팀원 요청 통합 진입점 함수 (stretch_id별 분기 처리)"""
    if not landmarks:
        return {"status": "not_detected", "score": 0, "feedback": "데이터가 없습니다.", "angle": 0}

    try:
        if stretch_id == 1 or stretch_id == "1":
            return evaluate_neck_shoulder_stretch(landmarks)
        elif stretch_id == 2 or stretch_id == "2":
            return evaluate_upper_body_flexion(landmarks)
        elif stretch_id == 3 or stretch_id == "3":
            return evaluate_squat(landmarks)
        else:
            return evaluate_neck_shoulder_stretch(landmarks)
    except Exception as e:
        return {"status": "not_detected", "score": 0, "feedback": f"판정 중 오류 발생: {str(e)}", "angle": 0}