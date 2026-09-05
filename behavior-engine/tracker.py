"""
Session logging, timeline tracking, and behavioral event/warning detection.

Extracted verbatim from the original main.py — detection logic,
cooldowns, and thresholds are unchanged.
"""

from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np

from config import (
    LOG_INTERVAL_SEC, WARNING_COOLDOWN, GAZE_BREAK_DURATION,
    MOVEMENT_SPIKE_VAR, POSTURE_INSTABILITY_SEC, EYE_CLOSURE_WARN_SEC,
    FACE_GONE_WARN_SEC, EYE_CLOSED_RATIO,
)


# ══════════════════════════════════════════════════════════════════
#  DATA STRUCTURES
# ══════════════════════════════════════════════════════════════════

@dataclass
class FrameLog:
    time:              float
    posture:           str
    movement:          str
    gaze:              str
    expression:        str
    gesture:           str
    posture_score:     float
    movement_score:    float
    eye_score:         float
    expression_score:  float
    gesture_score:     float
    composite_angle:   float
    variance:          float
    gaze_attention:    float   # 0-1 continuous attention estimate
    eye_ar:            float   # eye aspect ratio
    engagement_score:  float   # composite engagement 0-10
    attention_score:   float   # attention/focus score 0-10

    def to_dict(self):
        return {
            "time":             round(self.time, 2),
            "posture":          self.posture,
            "movement":         self.movement,
            "gaze":             self.gaze,
            "expression":       self.expression,
            "gesture":          self.gesture,
            "posture_score":    self.posture_score,
            "movement_score":   self.movement_score,
            "eye_score":        self.eye_score,
            "expression_score": self.expression_score,
            "gesture_score":    self.gesture_score,
            "composite_angle":  round(self.composite_angle, 2),
            "variance":         round(self.variance, 6),
            "gaze_attention":   round(self.gaze_attention, 3),
            "eye_ar":           round(self.eye_ar, 3),
            "engagement_score": self.engagement_score,
            "attention_score":  self.attention_score,
        }


@dataclass
class BehavioralEvent:
    time:       float
    event_type: str
    detail:     str
    severity:   str = "medium"   # low / medium / high

    def to_dict(self):
        return {
            "time":       round(self.time, 2),
            "event_type": self.event_type,
            "detail":     self.detail,
            "severity":   self.severity,
        }


# ══════════════════════════════════════════════════════════════════
#  SESSION LOGGER
# ══════════════════════════════════════════════════════════════════

class SessionLogger:
    def __init__(self):
        self.logs:       List[FrameLog] = []
        self.last_log_t: float          = -999.0

    def try_log(self, elapsed: float, frame_log: FrameLog):
        if elapsed - self.last_log_t >= LOG_INTERVAL_SEC:
            self.logs.append(frame_log)
            self.last_log_t = elapsed

    def get_logs(self) -> List[FrameLog]:
        return self.logs


# ══════════════════════════════════════════════════════════════════
#  TIMELINE TRACKER
# ══════════════════════════════════════════════════════════════════

class TimelineTracker:
    def __init__(self):
        self.times:       List[float] = []
        self.posture:     List[float] = []
        self.movement:    List[float] = []
        self.eye:         List[float] = []
        self.expression:  List[float] = []
        self.gesture:     List[float] = []
        self.overall:     List[float] = []
        self.engagement:  List[float] = []
        self.attention:   List[float] = []

    def record(self, elapsed: float, sp, sm, se, sx, sg, eng, att):
        self.times.append(round(elapsed, 2))
        self.posture.append(sp)
        self.movement.append(sm)
        self.eye.append(se)
        self.expression.append(sx)
        self.gesture.append(sg)
        self.overall.append(round((sp + sm + se + sx + sg) / 5, 2))
        self.engagement.append(eng)
        self.attention.append(att)

    def to_dict(self):
        return {
            "times":      self.times,
            "posture":    self.posture,
            "movement":   self.movement,
            "eye":        self.eye,
            "expression": self.expression,
            "gesture":    self.gesture,
            "overall":    self.overall,
            "engagement": self.engagement,
            "attention":  self.attention,
        }

    def trend(self, arr: List[float]) -> str:
        if len(arr) < 6:
            return "insufficient data"
        mid         = len(arr) // 2
        first_half  = float(np.mean(arr[:mid]))
        second_half = float(np.mean(arr[mid:]))
        delta       = second_half - first_half
        if delta > 0.5:
            return "improving"
        elif delta < -0.5:
            return "declining"
        return "stable"


# ══════════════════════════════════════════════════════════════════
#  BEHAVIORAL WARNING MANAGER
# ══════════════════════════════════════════════════════════════════

class BehavioralWarningManager:
    """
    Manages real-time warnings with per-type cooldown timers.
    Prevents spam, ensures warnings persist briefly on-screen.
    """

    def __init__(self):
        self._last_fired:    Dict[str, float] = {}
        self._active_warn:   Optional[str]    = None
        self._warn_expires:  float            = 0.0
        self.warn_log:       List[Dict]       = []   # full history

    def try_fire(self, warn_type: str, detail: str,
                 now: float, severity: str = "medium") -> bool:
        cooldown = WARNING_COOLDOWN.get(warn_type, 8.0)
        last     = self._last_fired.get(warn_type, -9999.0)
        if now - last < cooldown:
            return False
        self._last_fired[warn_type] = now
        self._active_warn  = warn_type
        self._warn_expires = now + 4.5
        self.warn_log.append({
            "time":     round(now, 2),
            "type":     warn_type,
            "detail":   detail,
            "severity": severity,
        })
        return True

    def current_warning(self, now: float) -> Optional[str]:
        if self._active_warn and now < self._warn_expires:
            return self._active_warn
        return None

    def warning_severity(self, warn_type: str) -> str:
        """Return severity for color coding."""
        high = {"Eyes Closed", "Face Not Visible", "Heavy Slouch",
                "Restless Behavior", "Nervous Movement"}
        low  = {"Low Eye Engagement", "Distraction Detected"}
        if warn_type in high:
            return "high"
        if warn_type in low:
            return "low"
        return "medium"


# ══════════════════════════════════════════════════════════════════
#  EVENT DETECTOR  (upgraded)
# ══════════════════════════════════════════════════════════════════

class EventDetector:
    def __init__(self):
        self.events:              List[BehavioralEvent] = []
        self.warning_manager:     BehavioralWarningManager = BehavioralWarningManager()
        self._gaze_away_start:    Optional[float] = None
        self._downward_gaze_buf:  deque           = deque(maxlen=30)
        self._posture_bad_start:  Optional[float] = None
        self._eye_closed_start:   Optional[float] = None
        self._face_gone_start:    Optional[float] = None
        self._last_spike_t:       float = -999.0
        self._restless_start:     Optional[float] = None
        self._distraction_count:  int   = 0
        self._downward_count:     int   = 0

    def update(self, elapsed: float, gaze: str, posture: str,
               variance: float, eye_ar: float, face_visible: bool,
               movement: str):
        """Full per-frame event evaluation."""

        # ── Gaze away ──
        if gaze != "At Camera":
            if self._gaze_away_start is None:
                self._gaze_away_start = elapsed
            else:
                away_dur = elapsed - self._gaze_away_start
                if away_dur >= GAZE_BREAK_DURATION:
                    fired = self.warning_manager.try_fire(
                        "Prolonged Gaze Break",
                        f"Gaze away ({gaze}) for {away_dur:.1f}s",
                        elapsed, severity="medium")
                    if fired:
                        self._log(elapsed, "Prolonged Gaze Break",
                                  f"Gaze ({gaze}) for >{GAZE_BREAK_DURATION:.0f}s",
                                  "medium")
                        self._distraction_count += 1
                        self._gaze_away_start = elapsed
        else:
            self._gaze_away_start = None

        # ── Repeated downward gaze ──
        self._downward_gaze_buf.append(1 if gaze == "Looking Down" else 0)
        if len(self._downward_gaze_buf) == 30:
            down_ratio = sum(self._downward_gaze_buf) / 30
            if down_ratio > 0.55:
                self._downward_count += 1
                fired = self.warning_manager.try_fire(
                    "Repeated Downward Gaze",
                    f"Downward gaze {down_ratio*100:.0f}% of recent frames",
                    elapsed, severity="medium")
                if fired:
                    self._log(elapsed, "Repeated Downward Gaze",
                              f"Downward gaze ratio: {down_ratio:.2f}", "medium")

        # ── Posture ──
        if posture not in ("Straight", "Calibrating", "No Pose", "Unknown"):
            if self._posture_bad_start is None:
                self._posture_bad_start = elapsed
            else:
                bad_dur = elapsed - self._posture_bad_start
                if bad_dur >= POSTURE_INSTABILITY_SEC:
                    sev = "high" if posture == "Heavy Slouch" else "medium"
                    warn_key = "Heavy Slouch" if posture == "Heavy Slouch" else "Posture Instability"
                    fired = self.warning_manager.try_fire(
                        warn_key,
                        f"Posture ({posture}) sustained {bad_dur:.1f}s",
                        elapsed, severity=sev)
                    if fired:
                        self._log(elapsed, warn_key,
                                  f"Non-upright posture ({posture}) for {bad_dur:.1f}s", sev)
                        self._posture_bad_start = elapsed
        else:
            self._posture_bad_start = None

        # ── Movement spike ──
        if variance > MOVEMENT_SPIKE_VAR and elapsed - self._last_spike_t > 5.0:
            fired = self.warning_manager.try_fire(
                "High Movement Variance",
                f"Movement variance={variance:.5f}",
                elapsed, severity="medium")
            if fired:
                self._log(elapsed, "High Movement Variance",
                          f"Variance={variance:.5f}", "medium")
                self._last_spike_t = elapsed

        # ── Restless movement ──
        if movement == "Restless":
            if self._restless_start is None:
                self._restless_start = elapsed
            elif elapsed - self._restless_start >= 6.0:
                fired = self.warning_manager.try_fire(
                    "Restless Behavior",
                    f"Continuous restless movement {elapsed - self._restless_start:.1f}s",
                    elapsed, severity="high")
                if fired:
                    self._log(elapsed, "Restless Behavior",
                              "Sustained elevated movement", "high")
                    self._restless_start = elapsed
        else:
            self._restless_start = None

        # ── Eye closure ──
        if eye_ar < EYE_CLOSED_RATIO:
            if self._eye_closed_start is None:
                self._eye_closed_start = elapsed
            elif elapsed - self._eye_closed_start >= EYE_CLOSURE_WARN_SEC:
                fired = self.warning_manager.try_fire(
                    "Eyes Closed",
                    f"Eyes closed for {elapsed - self._eye_closed_start:.1f}s",
                    elapsed, severity="high")
                if fired:
                    self._log(elapsed, "Eyes Closed",
                              f"Prolonged eye closure detected", "high")
                    self._eye_closed_start = elapsed
        else:
            self._eye_closed_start = None

        # ── Face not visible ──
        if not face_visible:
            if self._face_gone_start is None:
                self._face_gone_start = elapsed
            elif elapsed - self._face_gone_start >= FACE_GONE_WARN_SEC:
                fired = self.warning_manager.try_fire(
                    "Face Not Visible",
                    f"Face absent for {elapsed - self._face_gone_start:.1f}s",
                    elapsed, severity="high")
                if fired:
                    self._log(elapsed, "Face Not Visible",
                              "Face landmarks lost", "high")
                    self._face_gone_start = elapsed
        else:
            self._face_gone_start = None

    def _log(self, t: float, etype: str, detail: str, severity: str):
        self.events.append(BehavioralEvent(
            time=t, event_type=etype, detail=detail, severity=severity))

    def get_events(self) -> List[BehavioralEvent]:
        return self.events

    def latest_warning(self, now: float = 0.0) -> Optional[str]:
        return self.warning_manager.current_warning(now)

    @property
    def distraction_count(self) -> int:
        return self._distraction_count

    @property
    def downward_count(self) -> int:
        return self._downward_count
