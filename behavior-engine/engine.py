"""
BehaviorEngine — orchestrates camera capture, MediaPipe inference,
detection, scoring, session logging/event-detection, and (as of
Phase 3C) MJPEG frame streaming into the same real-time loop the
original main() ran.

This is the "reusable engine" produced by the Phase 3A refactor and
made headless in Phase 3C: `main.py` only bootstraps this class.
`engine.run()` now behaves like an analysis *service* rather than a
desktop app — no window, no keyboard controls. The backend is the
only controller: process launch = analysis start, SIGTERM = analysis
stop (graceful — the report is still generated on the way out, exactly
as the old [E] keypress used to do). No detection/scoring/report
logic was changed — only how the loop starts, stops, and is watched.
"""

import signal
import sys
import threading
import time

import cv2

from camera import Camera
from detector import (
    POSE, FACE, HANDS, mp_pose, mp_hands, mp_drawing,
    detect_posture, detect_head_tilt_face, detect_gaze,
    detect_expression, detect_gestures, detect_movement, close_all,
)
from scoring import calculate_scores
from tracker import FrameLog
from lifecycle import SessionLifecycle
from ui import draw_overlay
from stream_server import StreamServer


class BehaviorEngine:
    """Reusable, importable behavior-analysis engine.

    Headless usage (Phase 3C — driven entirely by the backend):
        engine = BehaviorEngine(stream_port=5xxx)
        engine.run()   # blocks; analysis starts immediately, ends on
                        # a "STOP" line on stdin (or SIGTERM/SIGINT) —
                        # report generated on the way out
    """

    def __init__(self, device_index: int = 0, stream_port: int | None = None):
        self.camera    = Camera(device_index=device_index)
        self.lifecycle = SessionLifecycle()
        self.prev_time = time.time()
        self.stream    = StreamServer(port=stream_port) if stream_port else None
        self._stop_requested = False

        # Backend is the only controller. The *primary* graceful-stop
        # channel is a "STOP" line on stdin (see _stdin_listener) —
        # deliberately NOT just SIGTERM, because on Windows
        # child_process.kill('SIGTERM') from Node calls TerminateProcess()
        # under the hood, which ends this process immediately and never
        # gives the signal handlers below a chance to run at all. Those
        # handlers are kept for POSIX/local-dev convenience (Ctrl+C), but
        # stdin is what Node's BehaviorEngineService.stop() actually
        # relies on now.
        signal.signal(signal.SIGTERM, self._request_stop)
        signal.signal(signal.SIGINT, self._request_stop)

        self._stdin_thread = threading.Thread(target=self._stdin_listener, daemon=True)
        self._stdin_thread.start()

    def _stdin_listener(self):
        try:
            for line in sys.stdin:
                if line.strip().upper() == "STOP":
                    print("[BEHAVIOR_ENGINE_STOP_SIGNAL_RECEIVED] via stdin — finalizing analysis")
                    self._stop_requested = True
                    return
        except (ValueError, OSError):
            # stdin closed/unavailable — signal handlers remain as fallback.
            return

    def _request_stop(self, signum, _frame):
        print(f"[BEHAVIOR_ENGINE_SIGNAL_RECEIVED] signum={signum} — finalizing analysis")
        self._stop_requested = True

    def _process_frame(self, frame):
        """Run MediaPipe + all detection/scoring for a single frame.

        Returns (frame_with_landmarks_drawn, data_dict_for_overlay).
        """
        lc = self.lifecycle
        h, w = frame.shape[:2]

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        pose_res = POSE.process(rgb)
        face_res = FACE.process(rgb)
        hand_res = HANDS.process(rgb)
        rgb.flags.writeable = True

        # Defaults
        posture_status = "No Pose"
        composite      = 0.0
        lateral        = "Unknown"
        forward        = "Unknown"
        gaze           = "Unknown"
        expression     = "Unknown"
        movement       = "No Pose"
        gesture        = "No Hands"
        variance       = 0.0
        gaze_attention = 0.5
        eye_ar         = 0.25
        face_visible   = False

        if pose_res.pose_landmarks:
            lms = pose_res.pose_landmarks.landmark
            posture_status, composite, _, _ = detect_posture(lms, w, h, lc.calibrator)
            movement, variance = detect_movement(
                lms, w, h, lc.movement_history, lc.last_valid)
            mp_drawing.draw_landmarks(
                frame, pose_res.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(0, 180, 255), thickness=2, circle_radius=3),
                mp_drawing.DrawingSpec(color=(80, 80, 220), thickness=2),
            )

        if face_res.multi_face_landmarks:
            face_lms            = face_res.multi_face_landmarks[0]
            face_visible        = True
            lateral, forward, _ = detect_head_tilt_face(face_lms, w, h)
            gaze, _, _, gaze_attention, eye_ar = detect_gaze(
                face_lms, w, h, lc.gaze_ratio_buf)
            expression, _, _, _ = detect_expression(face_lms, w, h)

        if hand_res.multi_hand_landmarks:
            for hand_lms in hand_res.multi_hand_landmarks:
                mp_drawing.draw_landmarks(
                    frame, hand_lms, mp_hands.HAND_CONNECTIONS,
                    mp_drawing.DrawingSpec(color=(0, 255, 180), thickness=2, circle_radius=3),
                    mp_drawing.DrawingSpec(color=(0, 180, 100), thickness=2),
                )

        gesture, _, _ = detect_gestures(hand_res, w, h)

        # ── State smoothing ──
        posture_status = lc.posture_buf.update(posture_status)
        movement       = lc.movement_buf.update(movement)
        gaze           = lc.gaze_buf.update(gaze)
        expression     = lc.expression_buf.update(expression)
        lateral        = lc.lateral_buf.update(lateral)
        forward        = lc.forward_buf.update(forward)
        gesture        = lc.gesture_buf.update(gesture)

        # ── Score calculation ──
        rp, rm, re, rx, rg, reng, ratt = calculate_scores(
            posture_status, movement, gaze, expression,
            gesture, composite, variance, gaze_attention, eye_ar)

        s_posture    = lc.sb_posture.update(rp)
        s_movement   = lc.sb_movement.update(rm)
        s_eye        = lc.sb_eye.update(re)
        s_expression = lc.sb_expression.update(rx)
        s_gesture    = lc.sb_gesture.update(rg)
        s_engagement = lc.sb_engagement.update(reng)
        s_attention  = lc.sb_attention.update(ratt)
        overall_live = round(
            (s_posture + s_movement + s_eye + s_expression + s_gesture) / 5, 1)

        # ── Session logging & event detection ──
        if lc.active:
            frame_log = FrameLog(
                time=lc.elapsed,
                posture=posture_status,
                movement=movement,
                gaze=gaze,
                expression=expression,
                gesture=gesture,
                posture_score=s_posture,
                movement_score=s_movement,
                eye_score=s_eye,
                expression_score=s_expression,
                gesture_score=s_gesture,
                composite_angle=composite,
                variance=variance,
                gaze_attention=gaze_attention,
                eye_ar=eye_ar,
                engagement_score=s_engagement,
                attention_score=s_attention,
            )
            lc.session_logger.try_log(lc.elapsed, frame_log)
            lc.timeline_tracker.record(
                lc.elapsed, s_posture, s_movement, s_eye,
                s_expression, s_gesture, s_engagement, s_attention)
            lc.event_detector.update(
                lc.elapsed, gaze, posture_status, variance,
                eye_ar, face_visible, movement)

        data = {
            "posture_status": posture_status,
            "composite":      composite,
            "lateral":        lateral,
            "forward":        forward,
            "gaze":           gaze,
            "expression":     expression,
            "movement":       movement,
            "gesture":        gesture,
            "s_posture":      s_posture,
            "s_movement":     s_movement,
            "s_eye":          s_eye,
            "s_expression":   s_expression,
            "s_gesture":      s_gesture,
            "s_engagement":   s_engagement,
            "s_attention":    s_attention,
            "overall_live":   overall_live,
        }
        return frame, data

    @staticmethod
    def _metrics_snapshot(data: dict) -> dict:
        """Maps already-computed values from `data` onto the field names
        BehaviorCameraCard polls for. This introduces no new scoring —
        every value here is read straight from what _process_frame
        already produced. Two UI labels ("Head Stability", "Confidence")
        don't have a same-named dimension in the original model, so they
        reuse the closest existing signal (movement stability,
        engagement score respectively) rather than inventing new math.
        """
        return {
            "eyeContact":    f"{data['s_eye']:.1f}/10",
            "posture":       data["posture_status"],
            "gesture":       data["gesture"],
            "headStability": data["movement"],
            "confidence":    f"{data['s_engagement']:.1f}/10",
            "behaviorScore": f"{data['overall_live']:.1f}/10",
        }

    def run(self):
        """Runs the analysis loop headlessly: starts immediately (the
        backend only launches this process when the interview starts),
        streams processed frames over MJPEG if a stream port was given,
        and stops gracefully on SIGTERM/SIGINT (report generated on the
        way out) — no window, no keyboard controls."""
        lc = self.lifecycle
        print("[BEHAVIOR_ENGINE_CAMERA_READY]")

        if self.stream:
            self.stream.start()
            print("[BEHAVIOR_ENGINE_STREAMING_STARTED]")

        lc.start()
        print("[BEHAVIOR_ENGINE_ANALYSIS_STARTED]")

        try:
            while not self._stop_requested:
                frame = self.camera.read()
                if frame is None:
                    continue

                now_wall  = time.time()
                remaining = lc.tick(now_wall)

                frame, data = self._process_frame(frame)

                warning     = lc.event_detector.latest_warning(now=lc.elapsed)
                event_count = len(lc.event_detector.get_events())

                fps            = 1.0 / max(now_wall - self.prev_time, 1e-6)
                self.prev_time = now_wall

                # draw_overlay is unchanged from Phase 3A — the same
                # informative panel that used to render in the desktop
                # window is now baked into the streamed frame instead.
                frame = draw_overlay(
                    frame, data, fps,
                    lc.active, lc.elapsed, remaining,
                    data["overall_live"], warning, event_count,
                    lc.calibrator,
                    distraction_count=lc.event_detector.distraction_count)

                if self.stream:
                    self.stream.publish_frame(frame)
                    self.stream.publish_metrics(self._metrics_snapshot(data))
        finally:
            print("[BEHAVIOR_ENGINE_ANALYSIS_STOPPING]")
            if self.stream:
                self.stream.stop()
                print("[BEHAVIOR_ENGINE_STREAMING_STOPPED]")

            # Capture before lc.stop() runs — stop() flips lc.active to
            # False internally, so these would otherwise always read as
            # "inactive" by the time we could log them.
            was_active     = lc.active
            elapsed_before = lc.elapsed

            try:
                session_dir = lc.stop()
            except Exception:
                import traceback
                print("[BEHAVIOR_ENGINE_REPORT_ERROR] exception during lc.stop() / report generation")
                traceback.print_exc()
                session_dir = None

            if session_dir:
                print(f"[BEHAVIOR_ENGINE_REPORT_FINALIZED] {session_dir}")
            else:
                print(
                    "[BEHAVIOR_ENGINE_REPORT_SKIPPED] "
                    f"active={was_active} elapsed={elapsed_before:.2f}s "
                    "(no report — either skipped as too short (<=2s) or a report-generation "
                    "exception occurred; see [BEHAVIOR_ENGINE_REPORT_ERROR]/[BEHAVIOR_ENGINE_REPORT_STAGE_ERROR] above)"
                )

            self.camera.release()
            close_all()
            print("[BEHAVIOR_ENGINE_ANALYSIS_STOPPED]")
