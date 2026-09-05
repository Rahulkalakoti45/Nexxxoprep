"""
State/score smoothing buffers, posture calibration, and the scoring engine.

Extracted verbatim from the original main.py — no scoring weights,
thresholds, or smoothing behavior changed.
"""

from collections import deque
from typing import Dict, List, Optional, Tuple

import numpy as np

from config import (
    STATE_SMOOTH_WINDOW, SMOOTHING_WINDOW, GAZE_SMOOTH_WINDOW,
)


# ══════════════════════════════════════════════════════════════════
#  STATE & SCORE SMOOTHING
# ══════════════════════════════════════════════════════════════════

class StateBuffer:
    """Majority-vote smoothing for categorical states."""
    def __init__(self, window=STATE_SMOOTH_WINDOW, default="Calibrating"):
        self.buf     = deque(maxlen=window)
        self.default = default

    def update(self, state: str) -> str:
        self.buf.append(state)
        if not self.buf:
            return self.default
        counts: Dict[str, int] = {}
        for s in self.buf:
            counts[s] = counts.get(s, 0) + 1
        return max(counts, key=counts.get)


class ScoreBuffer:
    """Exponential-weighted moving average for continuous scores."""
    def __init__(self, window=SMOOTHING_WINDOW):
        self.buf = deque(maxlen=window)

    def update(self, val: float) -> float:
        self.buf.append(val)
        return round(float(np.mean(self.buf)), 1) if self.buf else val

    def std(self) -> float:
        return float(np.std(self.buf)) if len(self.buf) > 1 else 0.0


class GazeBuffer:
    """Dedicated smoothing for gaze ratio values (horizontal + vertical)."""
    def __init__(self, window=GAZE_SMOOTH_WINDOW):
        self.h_buf = deque(maxlen=window)
        self.v_buf = deque(maxlen=window)

    def update(self, h: float, v: float) -> Tuple[float, float]:
        self.h_buf.append(h)
        self.v_buf.append(v)
        sh = float(np.median(self.h_buf))
        sv = float(np.median(self.v_buf))
        return sh, sv


class PostureCalibrator:
    """
    Adaptive baseline calibration.
    Computes a running reference composite angle during the first
    CALIB_FRAMES frames, then adjusts thresholds per-person.
    """
    CALIB_FRAMES = 60

    def __init__(self):
        self._samples: List[float] = []
        self._baseline: Optional[float] = None
        self._offset: float = 0.0
        self.calibrated: bool = False

    def feed(self, composite: float):
        if self.calibrated:
            return
        if composite > 0:
            self._samples.append(composite)
        if len(self._samples) >= self.CALIB_FRAMES:
            self._baseline = float(np.percentile(self._samples, 25))
            self._offset   = max(self._baseline - 8.0, 0.0)
            self.calibrated = True

    def adjust(self, composite: float) -> float:
        """Return composite with personal baseline removed."""
        return max(composite - self._offset, 0.0)

    @property
    def progress(self) -> float:
        return min(len(self._samples) / self.CALIB_FRAMES, 1.0)


# ══════════════════════════════════════════════════════════════════
#  SCORING ENGINE  (upgraded — engagement + attention scoring)
# ══════════════════════════════════════════════════════════════════

def calculate_scores(posture_status: str, movement_status: str, gaze_status: str,
                     expression: str, gesture: str,
                     composite_angle: float, variance: float,
                     gaze_attention: float, eye_ar: float):
    """
    Returns:
      posture_score, movement_score, eye_score, expression_score,
      gesture_score, engagement_score, attention_score
    All scores 0–10.
    """
    # ── Posture ──
    if posture_status == "Straight":
        posture_score = max(10 - composite_angle * 0.20, 7.5)
    elif posture_status == "Slightly Slouched":
        posture_score = max(10 - composite_angle * 0.40, 4.0)
    elif posture_status == "Slouched":
        posture_score = max(10 - composite_angle * 0.55, 2.0)
    elif posture_status == "Heavy Slouch":
        posture_score = max(10 - composite_angle * 0.70, 0.5)
    elif posture_status in ("Leaning Left", "Leaning Right"):
        posture_score = 4.5
    else:
        posture_score = 5.0

    # ── Movement ──
    if movement_status == "Stable":
        movement_score = 10.0
    elif movement_status == "Moderate":
        movement_score = max(10 - variance * 650, 6.0)
    elif movement_status == "Active":
        movement_score = max(10 - variance * 900, 4.0)
    elif movement_status == "Restless":
        movement_score = max(10 - variance * 1200, 0.0)
    else:
        movement_score = 5.0

    # ── Eye contact ──
    eye_map = {
        "At Camera":    10.0,
        "Looking Left":  3.5,
        "Looking Right": 3.5,
        "Looking Up":    4.5,
        "Looking Down":  2.5,
        "Eyes Closed":   1.0,
        "Unknown":       5.0,
    }
    eye_score = eye_map.get(gaze_status, 5.0)

    # ── Expression ──
    expr_map = {
        "Smiling":     10.0,
        "Neutral":      7.5,
        "Blinking":     5.0,
        "Tense":        4.0,
        "Eyes Closed":  2.0,
        "Unknown":      5.0,
    }
    expression_score = expr_map.get(expression, 5.0)

    # ── Gesture ──
    gest_map = {
        "No Hands":   6.0,
        "Open Palm":  10.0,
        "Pointing":    8.0,
        "Partial":     7.0,
        "Closed Fist": 4.0,
    }
    base_gest   = gesture.split(" / ")[0].strip()
    gesture_score = gest_map.get(base_gest, 5.0)

    # ── Engagement score (composite behavioral signal) ──
    # Engagement reflects active, positive participation signals
    engagement_score = (
        eye_score        * 0.35 +
        expression_score * 0.25 +
        posture_score    * 0.20 +
        gesture_score    * 0.10 +
        movement_score   * 0.10
    )

    # ── Attention score (focus/concentration index) ──
    # Attention reflects sustained, stable, camera-directed focus
    attention_score = (
        gaze_attention * 10  * 0.50 +
        eye_score            * 0.30 +
        movement_score       * 0.20
    )

    return (
        round(min(posture_score,     10.0), 1),
        round(min(movement_score,    10.0), 1),
        round(min(eye_score,         10.0), 1),
        round(min(expression_score,  10.0), 1),
        round(min(gesture_score,     10.0), 1),
        round(min(engagement_score,  10.0), 1),
        round(min(attention_score,   10.0), 1),
    )
