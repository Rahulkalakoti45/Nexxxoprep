"""
MediaPipe setup and per-frame detection modules:
posture, head tilt, gaze/eye-contact, expression, hand gesture, movement.

Extracted verbatim from the original main.py — no detection algorithm,
landmark index, or threshold changes.
"""

from collections import deque
from typing import Optional

import mediapipe as mp
import numpy as np

from config import (
    EXP_SMOOTH_ALPHA, SPINE_STRAIGHT_MAX, SPINE_SLIGHT_MAX, SPINE_SLOUCH_MAX,
    BLINK_THRESHOLD, SMILE_RATIO_THRESHOLD, EYE_CLOSED_RATIO,
    GAZE_H_INNER, GAZE_H_OUTER, GAZE_V_INNER, GAZE_V_OUTER,
    MOVEMENT_STABLE_MAX, MOVEMENT_MODERATE_MAX, MOVEMENT_RESTLESS_MIN,
)
from scoring import PostureCalibrator, GazeBuffer


# ══════════════════════════════════════════════════════════════════
#  MEDIAPIPE SETUP
# ══════════════════════════════════════════════════════════════════

mp_pose      = mp.solutions.pose
mp_face_mesh = mp.solutions.face_mesh
mp_hands     = mp.solutions.hands
mp_drawing   = mp.solutions.drawing_utils

POSE = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    smooth_landmarks=True,
    enable_segmentation=False,
    min_detection_confidence=0.55,
    min_tracking_confidence=0.55,
)

FACE = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.55,
    min_tracking_confidence=0.55,
)

HANDS = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    model_complexity=0,
    min_detection_confidence=0.55,
    min_tracking_confidence=0.55,
)

LM = mp_pose.PoseLandmark


# ══════════════════════════════════════════════════════════════════
#  FACE MESH LANDMARK INDICES
# ══════════════════════════════════════════════════════════════════

LEFT_IRIS       = [474, 475, 476, 477]
RIGHT_IRIS      = [469, 470, 471, 472]
LEFT_EYE_TOP    = 159
LEFT_EYE_BOT    = 145
LEFT_EYE_LEFT   = 33
LEFT_EYE_RIGHT  = 133
RIGHT_EYE_TOP   = 386
RIGHT_EYE_BOT   = 374
RIGHT_EYE_LEFT  = 362
RIGHT_EYE_RIGHT = 263
MOUTH_LEFT      = 61
MOUTH_RIGHT     = 291
MOUTH_TOP       = 13
MOUTH_BOTTOM    = 14
NOSE_TIP        = 1
CHIN            = 152
LEFT_CHEEK      = 234
RIGHT_CHEEK     = 454
FOREHEAD        = 10
LEFT_BROW_INNER = 336
RIGHT_BROW_INNER= 107

FINGERTIPS  = [4, 8, 12, 16, 20]
FINGER_MIDS = [3, 6, 10, 14, 18]
WRIST_IDX   = 0

TRACKED_LMS = [LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER,
               LM.LEFT_WRIST, LM.RIGHT_WRIST]
VECTOR_LEN  = len(TRACKED_LMS) * 2


# ══════════════════════════════════════════════════════════════════
#  GEOMETRY HELPERS
# ══════════════════════════════════════════════════════════════════

def safe_lm_pose(landmarks, idx, w, h):
    lm = landmarks[idx]
    if lm.visibility < 0.4:
        return None
    return (lm.x * w, lm.y * h)


def face_pt(face_lms, idx, w, h):
    lm = face_lms.landmark[idx]
    return (lm.x * w, lm.y * h)


def dist(p1, p2) -> float:
    return float(np.linalg.norm(np.array(p1, dtype=np.float32) -
                                np.array(p2, dtype=np.float32)))


def angle_of_vector(p1, p2) -> float:
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    return float(np.degrees(np.arctan2(abs(dx), max(abs(dy), 1e-6))))


def exp_smooth(new_val: float, old_val: float,
               alpha: float = EXP_SMOOTH_ALPHA) -> float:
    if old_val is None:
        return new_val
    return alpha * new_val + (1.0 - alpha) * old_val


def fmt_time(seconds: float) -> str:
    return f"{int(seconds)//60:02d}:{int(seconds)%60:02d}"


# ══════════════════════════════════════════════════════════════════
#  MODULE 1 — POSTURE DETECTION  (upgraded with calibration)
# ══════════════════════════════════════════════════════════════════

def detect_posture(landmarks, w, h, calibrator: PostureCalibrator):
    l_sh = safe_lm_pose(landmarks, LM.LEFT_SHOULDER,  w, h)
    r_sh = safe_lm_pose(landmarks, LM.RIGHT_SHOULDER, w, h)
    l_hi = safe_lm_pose(landmarks, LM.LEFT_HIP,       w, h)
    r_hi = safe_lm_pose(landmarks, LM.RIGHT_HIP,      w, h)
    l_ea = safe_lm_pose(landmarks, LM.LEFT_EAR,       w, h)
    r_ea = safe_lm_pose(landmarks, LM.RIGHT_EAR,      w, h)

    if not all([l_sh, r_sh, l_hi, r_hi]):
        return "Unknown", 0.0, 0.0, 0.0

    sh_mid      = ((l_sh[0] + r_sh[0]) / 2, (l_sh[1] + r_sh[1]) / 2)
    hi_mid      = ((l_hi[0] + r_hi[0]) / 2, (l_hi[1] + r_hi[1]) / 2)
    spine_angle = angle_of_vector(hi_mid, sh_mid)

    # Shoulder roll (asymmetry %)
    shoulder_roll = abs(l_sh[1] - r_sh[1]) / max(w, 1) * 100

    neck_angle = 0.0
    if l_ea and r_ea:
        ear_mid    = ((l_ea[0] + r_ea[0]) / 2, (l_ea[1] + r_ea[1]) / 2)
        neck_angle = angle_of_vector(sh_mid, ear_mid)

    # Forward lean: if shoulders significantly above expected hip-to-shoulder midpoint
    lean_score = 0.0
    if sh_mid[1] < hi_mid[1]:  # shoulders above hips (normal)
        torso_h = abs(hi_mid[1] - sh_mid[1])
        if torso_h > 0:
            # Horizontal displacement of shoulder vs hip midpoints
            h_disp = abs(sh_mid[0] - hi_mid[0]) / max(torso_h, 1) * 10
            lean_score = h_disp

    composite = (spine_angle * 0.50 + neck_angle * 0.28 +
                 shoulder_roll * 0.12 + lean_score * 0.10)

    # Feed calibrator and get adjusted composite
    calibrator.feed(composite)
    adj_composite = calibrator.adjust(composite)

    if adj_composite < SPINE_STRAIGHT_MAX:
        status = "Straight"
    elif adj_composite < SPINE_SLIGHT_MAX:
        status = "Slightly Slouched"
    elif adj_composite < SPINE_SLOUCH_MAX:
        status = "Slouched"
    else:
        status = "Heavy Slouch"

    # Leaning detection (raw composite)
    if composite > 35 and shoulder_roll > 3.5:
        # Determine lean direction from shoulder height asymmetry
        if l_sh[1] < r_sh[1]:
            status = "Leaning Left"
        else:
            status = "Leaning Right"

    return status, composite, spine_angle, neck_angle


# ══════════════════════════════════════════════════════════════════
#  MODULE 2 — HEAD TILT (FACE MESH)
# ══════════════════════════════════════════════════════════════════

def detect_head_tilt_face(face_lms, w, h):
    nose    = face_pt(face_lms, NOSE_TIP,    w, h)
    chin    = face_pt(face_lms, CHIN,        w, h)
    l_cheek = face_pt(face_lms, LEFT_CHEEK,  w, h)
    r_cheek = face_pt(face_lms, RIGHT_CHEEK, w, h)

    face_width  = max(dist(l_cheek, r_cheek), 1)
    face_height = max(dist(nose, chin), 1)
    dx_roll     = r_cheek[1] - l_cheek[1]
    roll_deg    = float(np.degrees(np.arctan2(dx_roll, face_width)))

    if roll_deg > 9:
        lateral = "Tilted Right"
    elif roll_deg < -9:
        lateral = "Tilted Left"
    else:
        lateral = "Center"

    nose_x_norm = (nose[0] - l_cheek[0]) / face_width
    if nose_x_norm < 0.33:
        forward = "Turned Right"
    elif nose_x_norm > 0.67:
        forward = "Turned Left"
    else:
        nose_chin_x   = abs(chin[0] - nose[0])
        forward_ratio = nose_chin_x / face_height
        if forward_ratio > 0.20:
            forward = "Forward"
        else:
            forward = "Neutral"

    return lateral, forward, abs(roll_deg)


# ══════════════════════════════════════════════════════════════════
#  MODULE 3 — EYE CONTACT / GAZE  (significantly upgraded)
# ══════════════════════════════════════════════════════════════════

def detect_gaze(face_lms, w, h, gaze_buffer: GazeBuffer):
    """
    Returns:
      status (str), gaze_ratio (float), vert_ratio (float),
      attention_index (0-1), eye_ar (float)
    """
    try:
        # ── Iris centers ──
        l_iris_pts = [face_pt(face_lms, i, w, h) for i in LEFT_IRIS]
        r_iris_pts = [face_pt(face_lms, i, w, h) for i in RIGHT_IRIS]
        l_iris_cx  = float(np.mean([p[0] for p in l_iris_pts]))
        l_iris_cy  = float(np.mean([p[1] for p in l_iris_pts]))
        r_iris_cx  = float(np.mean([p[0] for p in r_iris_pts]))
        r_iris_cy  = float(np.mean([p[1] for p in r_iris_pts]))

        # ── Eye corner coordinates ──
        l_eye_l = face_pt(face_lms, LEFT_EYE_LEFT,   w, h)
        l_eye_r = face_pt(face_lms, LEFT_EYE_RIGHT,  w, h)
        r_eye_l = face_pt(face_lms, RIGHT_EYE_LEFT,  w, h)
        r_eye_r = face_pt(face_lms, RIGHT_EYE_RIGHT, w, h)
        l_eye_w = max(dist(l_eye_l, l_eye_r), 1)
        r_eye_w = max(dist(r_eye_l, r_eye_r), 1)

        # Horizontal gaze ratio (0=far left, 1=far right)
        l_ratio    = (l_iris_cx - l_eye_l[0]) / l_eye_w
        r_ratio    = (r_iris_cx - r_eye_l[0]) / r_eye_w
        raw_h      = (l_ratio + r_ratio) / 2

        # ── Vertical gaze ──
        l_eye_top = face_pt(face_lms, LEFT_EYE_TOP,  w, h)
        l_eye_bot = face_pt(face_lms, LEFT_EYE_BOT,  w, h)
        r_eye_top = face_pt(face_lms, RIGHT_EYE_TOP, w, h)
        r_eye_bot = face_pt(face_lms, RIGHT_EYE_BOT, w, h)
        l_eye_h   = max(dist(l_eye_top, l_eye_bot), 1)
        r_eye_h   = max(dist(r_eye_top, r_eye_bot), 1)

        l_vert    = (l_iris_cy - l_eye_top[1]) / l_eye_h
        r_vert    = (r_iris_cy - r_eye_top[1]) / r_eye_h
        raw_v     = (l_vert + r_vert) / 2

        # Eye Aspect Ratio (EAR) for closure detection
        l_ear_val = l_eye_h / l_eye_w
        r_ear_val = r_eye_h / r_eye_w
        eye_ar    = (l_ear_val + r_ear_val) / 2

        # ── Smooth gaze ratios ──
        gaze_ratio, vert_ratio = gaze_buffer.update(raw_h, raw_v)

        # ── Classify gaze direction ──
        at_camera = (GAZE_H_INNER <= gaze_ratio <= GAZE_H_OUTER and
                     GAZE_V_INNER <= vert_ratio <= GAZE_V_OUTER)

        if eye_ar < EYE_CLOSED_RATIO:
            status = "Eyes Closed"
        elif at_camera:
            status = "At Camera"
        elif gaze_ratio < GAZE_H_INNER:
            status = "Looking Left"
        elif gaze_ratio > GAZE_H_OUTER:
            status = "Looking Right"
        elif vert_ratio < GAZE_V_INNER:
            status = "Looking Up"
        else:
            status = "Looking Down"

        # Attention index: how centered is gaze (0=far away, 1=perfect center)
        h_dev    = abs(gaze_ratio - 0.5) * 2   # 0–1
        v_dev    = abs(vert_ratio - 0.5) * 2
        att_idx  = max(1.0 - (h_dev * 0.6 + v_dev * 0.4), 0.0)

        return status, gaze_ratio, vert_ratio, att_idx, eye_ar

    except Exception:
        return "Unknown", 0.5, 0.5, 0.5, 0.25


# ══════════════════════════════════════════════════════════════════
#  MODULE 4 — EXPRESSION  (upgraded)
# ══════════════════════════════════════════════════════════════════

def detect_expression(face_lms, w, h):
    """
    Returns expression label, smile_ratio, eye_ar, brow_tension_index.
    Brow tension is a stress-related facial signal approximation only.
    """
    try:
        mouth_l = face_pt(face_lms, MOUTH_LEFT,   w, h)
        mouth_r = face_pt(face_lms, MOUTH_RIGHT,  w, h)
        mouth_t = face_pt(face_lms, MOUTH_TOP,    w, h)
        mouth_b = face_pt(face_lms, MOUTH_BOTTOM, w, h)

        mouth_width  = dist(mouth_l, mouth_r)
        mouth_height = max(dist(mouth_t, mouth_b), 1)
        smile_ratio  = mouth_width / mouth_height

        l_top = face_pt(face_lms, LEFT_EYE_TOP,   w, h)
        l_bot = face_pt(face_lms, LEFT_EYE_BOT,   w, h)
        r_top = face_pt(face_lms, RIGHT_EYE_TOP,  w, h)
        r_bot = face_pt(face_lms, RIGHT_EYE_BOT,  w, h)
        l_ew  = face_pt(face_lms, LEFT_EYE_LEFT,  w, h)
        l_er  = face_pt(face_lms, LEFT_EYE_RIGHT, w, h)
        r_ew  = face_pt(face_lms, RIGHT_EYE_LEFT, w, h)
        r_er  = face_pt(face_lms, RIGHT_EYE_RIGHT,w, h)

        l_eye_w = max(dist(l_ew, l_er), 1)
        r_eye_w = max(dist(r_ew, r_er), 1)
        l_ear   = dist(l_top, l_bot) / l_eye_w
        r_ear   = dist(r_top, r_bot) / r_eye_w
        avg_ear = (l_ear + r_ear) / 2

        # Brow tension approximation (inner brow distance vs face width)
        try:
            l_brow = face_pt(face_lms, LEFT_BROW_INNER,  w, h)
            r_brow = face_pt(face_lms, RIGHT_BROW_INNER, w, h)
            nose   = face_pt(face_lms, NOSE_TIP, w, h)
            l_ch   = face_pt(face_lms, LEFT_CHEEK,  w, h)
            r_ch   = face_pt(face_lms, RIGHT_CHEEK, w, h)
            face_w = max(dist(l_ch, r_ch), 1)
            brow_sep  = dist(l_brow, r_brow)
            # Low separation = brows pulled together = tension indicator
            brow_tension = max(1.0 - brow_sep / (face_w * 0.35), 0.0)
        except Exception:
            brow_tension = 0.0

        blinking = avg_ear < BLINK_THRESHOLD

        # Filtered smile: require meaningful smile_ratio AND no blinking
        if smile_ratio > SMILE_RATIO_THRESHOLD and not blinking and avg_ear > 0.18:
            return "Smiling", smile_ratio, avg_ear, brow_tension
        elif avg_ear < EYE_CLOSED_RATIO:
            return "Eyes Closed", smile_ratio, avg_ear, brow_tension
        elif blinking:
            return "Blinking", smile_ratio, avg_ear, brow_tension
        elif brow_tension > 0.55:
            return "Tense", smile_ratio, avg_ear, brow_tension

        return "Neutral", smile_ratio, avg_ear, brow_tension

    except Exception:
        return "Unknown", 3.0, 0.25, 0.0


# ══════════════════════════════════════════════════════════════════
#  MODULE 5 — HAND GESTURE  (upgraded)
# ══════════════════════════════════════════════════════════════════

def classify_hand(hand_lms, w, h) -> str:
    wrist    = (hand_lms.landmark[WRIST_IDX].x * w,
                hand_lms.landmark[WRIST_IDX].y * h)
    extended = 0
    for tip, mid in zip(FINGERTIPS[1:], FINGER_MIDS[1:]):
        tip_pt = (hand_lms.landmark[tip].x * w, hand_lms.landmark[tip].y * h)
        mid_pt = (hand_lms.landmark[mid].x * w, hand_lms.landmark[mid].y * h)
        if dist(tip_pt, wrist) > dist(mid_pt, wrist) * 1.05:
            extended += 1
    thumb_tip = (hand_lms.landmark[4].x * w, hand_lms.landmark[4].y * h)
    thumb_ip  = (hand_lms.landmark[3].x * w, hand_lms.landmark[3].y * h)
    if dist(thumb_tip, wrist) > dist(thumb_ip, wrist):
        extended += 1
    if extended >= 4:
        return "Open Palm"
    elif extended == 0:
        return "Closed Fist"
    elif extended == 1:
        return "Pointing"
    return "Partial"


def detect_gestures(hand_results, w, h):
    if not hand_results or not hand_results.multi_hand_landmarks:
        return "No Hands", 0, []
    gestures = [classify_hand(lm, w, h) for lm in hand_results.multi_hand_landmarks]
    combined = f"{gestures[0]} / {gestures[1]}" if len(gestures) == 2 else gestures[0]
    return combined, len(gestures), gestures


# ══════════════════════════════════════════════════════════════════
#  MODULE 6 — MOVEMENT DETECTION  (upgraded)
# ══════════════════════════════════════════════════════════════════

def detect_movement(landmarks, w, h, history: deque, last_valid: list):
    coords = []
    for i, idx in enumerate(TRACKED_LMS):
        pt   = safe_lm_pose(landmarks, idx, w, h)
        base = i * 2
        if pt:
            last_valid[base]     = exp_smooth(pt[0] / w, last_valid[base])
            last_valid[base + 1] = exp_smooth(pt[1] / h, last_valid[base + 1])
        coords.append(last_valid[base])
        coords.append(last_valid[base + 1])

    if len(coords) != VECTOR_LEN:
        coords = (coords + [0.0] * VECTOR_LEN)[:VECTOR_LEN]

    history.append(coords)
    if len(history) < 5:
        return "Calibrating", 0.0

    try:
        arr      = np.array(list(history), dtype=np.float32)
        variance = float(np.mean(np.var(arr, axis=0)))

        # Jitter reduction: compare smoothed vs raw velocity
        if len(history) >= 3:
            last3    = np.array(list(history)[-3:], dtype=np.float32)
            velocity = float(np.mean(np.abs(np.diff(last3, axis=0))))
            # Blend variance and velocity for robustness
            combined = variance * 0.65 + velocity * 0.35
        else:
            combined = variance

    except Exception:
        return "Error", 0.0

    if combined < MOVEMENT_STABLE_MAX:
        return "Stable", variance
    elif combined < MOVEMENT_MODERATE_MAX:
        return "Moderate", variance
    elif combined < MOVEMENT_RESTLESS_MIN:
        return "Active", variance
    return "Restless", variance


def close_all():
    """Release MediaPipe model resources. Call on engine shutdown."""
    POSE.close()
    FACE.close()
    HANDS.close()
