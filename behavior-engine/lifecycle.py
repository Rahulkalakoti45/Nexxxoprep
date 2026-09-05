"""
Session lifecycle management: start / stop / time-limit auto-stop,
and triggering report generation.

This isolates exactly the state transitions that used to live inline
inside main()'s while-loop (the 's' / 'e' key handling and the
INTERVIEW_DURATION time-limit branch) so the engine loop and the
future integration layer only need to call start()/stop() without
knowing about report generation internals.
"""

import time
from collections import deque
from typing import Optional

from config import INTERVIEW_DURATION, MOVEMENT_HISTORY
from detector import VECTOR_LEN
from scoring import (
    StateBuffer, ScoreBuffer, GazeBuffer, PostureCalibrator,
)
from tracker import SessionLogger, TimelineTracker, EventDetector
from reports import SessionAggregator, ReportGenerator


class SessionLifecycle:
    """
    Owns all per-session state (buffers, loggers, calibrator) and the
    transitions between idle / active / ended. Behavior mirrors the
    original main() loop's session_active handling exactly.
    """

    def __init__(self):
        self.movement_history = deque(maxlen=MOVEMENT_HISTORY)
        self.last_valid       = [0.5] * VECTOR_LEN

        self.active     = False
        self.start_t    = 0.0
        self.elapsed    = 0.0

        self._new_session_state()

    def _new_session_state(self):
        # State smoothing buffers
        self.posture_buf    = StateBuffer(default="Calibrating")
        self.movement_buf   = StateBuffer(default="Calibrating")
        self.gaze_buf       = StateBuffer(default="Calibrating")
        self.expression_buf = StateBuffer(default="Calibrating")
        self.lateral_buf    = StateBuffer(default="Center")
        self.forward_buf    = StateBuffer(default="Neutral")
        self.gesture_buf    = StateBuffer(default="No Hands")

        # Score smoothing buffers
        self.sb_posture    = ScoreBuffer()
        self.sb_movement   = ScoreBuffer()
        self.sb_eye        = ScoreBuffer()
        self.sb_expression = ScoreBuffer()
        self.sb_gesture    = ScoreBuffer()
        self.sb_engagement = ScoreBuffer()
        self.sb_attention  = ScoreBuffer()

        # Dedicated gaze ratio smoother
        self.gaze_ratio_buf = GazeBuffer()

        # Posture calibrator
        self.calibrator = PostureCalibrator()

        # Session objects
        self.session_logger   = SessionLogger()
        self.timeline_tracker = TimelineTracker()
        self.event_detector    = EventDetector()

    def start(self):
        """Equivalent to the original 'S' keypress branch."""
        if self.active:
            return
        self.active         = True
        self.start_t         = time.time()
        self.elapsed         = 0.0
        self.movement_history = deque(maxlen=MOVEMENT_HISTORY)
        self.last_valid        = [0.5] * VECTOR_LEN
        self._new_session_state()
        print("[INFO] Session started.")

    def stop(self) -> Optional[str]:
        """
        Equivalent to the original 'E' keypress branch (and the
        time-limit auto-stop branch). Generates and saves the report.
        Returns the report session directory, or None if there was
        nothing worth reporting (elapsed <= 2.0s, same guard as before).
        """
        if not self.active or self.elapsed <= 2.0:
            return None
        self.active = False
        print("[INFO] Session ended — generating report …")
        agg = SessionAggregator.compute(
            self.session_logger.get_logs(), self.timeline_tracker,
            self.elapsed, self.event_detector.get_events())
        session_dir = ReportGenerator.save(
            agg, self.event_detector.get_events(),
            self.timeline_tracker, self.session_logger.get_logs())
        return session_dir

    def tick(self, now_wall: float) -> float:
        """
        Advance elapsed time and auto-stop when INTERVIEW_DURATION is
        reached. Returns the current 'remaining' seconds (0 if unlimited
        session is idle, or the countdown while active).
        """
        if self.active:
            self.elapsed = now_wall - self.start_t
            remaining = max(INTERVIEW_DURATION - self.elapsed, 0.0) if INTERVIEW_DURATION > 0 else 0.0
            if INTERVIEW_DURATION > 0 and self.elapsed >= INTERVIEW_DURATION:
                print("[INFO] Time limit reached — generating report …")
                self.active = False
                agg = SessionAggregator.compute(
                    self.session_logger.get_logs(), self.timeline_tracker,
                    self.elapsed, self.event_detector.get_events())
                ReportGenerator.save(
                    agg, self.event_detector.get_events(),
                    self.timeline_tracker, self.session_logger.get_logs())
            return remaining
        return float(INTERVIEW_DURATION)
