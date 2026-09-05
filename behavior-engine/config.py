"""
Configuration & constants for the AI Interview Behavior Analyzer.

Every value here is copied verbatim from the original monolithic main.py.
No thresholds, weights, or timings have been changed as part of the
Phase 3A structural refactor — only their location moved.
"""

from typing import Dict
import cv2

# ══════════════════════════════════════════════════════════════════
#  SMOOTHING WINDOWS
# ══════════════════════════════════════════════════════════════════

SMOOTHING_WINDOW        = 18
MOVEMENT_HISTORY        = 25
STATE_SMOOTH_WINDOW     = 12
GAZE_SMOOTH_WINDOW      = 10

# Posture thresholds (composite angle)
SPINE_STRAIGHT_MAX      = 12.0
SPINE_SLIGHT_MAX        = 24.0
SPINE_SLOUCH_MAX        = 38.0
# Anything above SPINE_SLOUCH_MAX → Heavy Slouch

MOVEMENT_STABLE_MAX     = 0.0012
MOVEMENT_MODERATE_MAX   = 0.004
MOVEMENT_RESTLESS_MIN   = 0.007

EXP_SMOOTH_ALPHA        = 0.30          # lower = smoother
POSTURE_CALIB_ALPHA     = 0.05          # very slow drift for calibration

BLINK_THRESHOLD         = 0.21
SMILE_RATIO_THRESHOLD   = 3.3
EYE_CLOSED_RATIO        = 0.15          # EAR below this = closed
EYE_CLOSED_DURATION     = 2.5          # seconds before closure warning

GAZE_H_INNER            = 0.32         # gaze ratio bounds for "At Camera"
GAZE_H_OUTER            = 0.68
GAZE_V_INNER            = 0.28
GAZE_V_OUTER            = 0.72

INTERVIEW_DURATION      = 0             # seconds; 0 = unlimited.
# Phase 3C: the backend is now the only lifecycle controller (it sends
# SIGTERM when the interview ends) — a fixed timer here would silently
# cut behavior tracking short on any interview longer than the old
# desktop-app default of 120s. This is a session-duration setting, not a
# detection/scoring threshold, so changing it doesn't touch Phase 3A
# analysis algorithms.
LOG_INTERVAL_SEC        = 1.0
REPORTS_DIR             = "reports"

GAZE_BREAK_DURATION     = 3.5
MOVEMENT_SPIKE_VAR      = 0.007
POSTURE_INSTABILITY_SEC = 5.0
EYE_CLOSURE_WARN_SEC    = 2.5
FACE_GONE_WARN_SEC      = 3.0

# Warning cooldowns (seconds before same warning fires again)
WARNING_COOLDOWN: Dict[str, float] = {
    "Prolonged Gaze Break":     8.0,
    "Repeated Downward Gaze":   10.0,
    "Posture Instability":      8.0,
    "Heavy Slouch":             10.0,
    "Leaning Forward":          8.0,
    "High Movement Variance":   6.0,
    "Restless Behavior":        8.0,
    "Eyes Closed":              5.0,
    "Face Not Visible":         5.0,
    "Low Eye Engagement":       12.0,
    "Distraction Detected":     10.0,
    "Nervous Movement":         8.0,
}

FONT           = cv2.FONT_HERSHEY_SIMPLEX
COLOR_GREEN    = (0, 220, 110)
COLOR_RED      = (0, 70, 230)
COLOR_YELLOW   = (0, 200, 245)
COLOR_WHITE    = (245, 245, 245)
COLOR_ACCENT   = (200, 160, 0)
COLOR_MUTED    = (120, 120, 150)
COLOR_PANEL_BG = (12, 12, 22)
COLOR_HEADER   = (25, 25, 45)
COLOR_DIVIDER  = (50, 50, 80)
COLOR_WARN     = (0, 100, 255)
COLOR_TIMER    = (180, 220, 255)
COLOR_ORANGE   = (0, 140, 255)
COLOR_CYAN     = (220, 200, 0)
COLOR_PURPLE   = (200, 80, 180)
