"""
On-screen overlay rendering (OpenCV drawing only).

Extracted verbatim from the original main.py — same panel layout,
colors, and text. Isolated here so the detection/session pipeline
never has to know how (or whether) results are rendered.
"""

from typing import Optional

import cv2

from config import (
    FONT, COLOR_GREEN, COLOR_RED, COLOR_YELLOW, COLOR_WHITE, COLOR_ACCENT,
    COLOR_MUTED, COLOR_PANEL_BG, COLOR_HEADER, COLOR_DIVIDER, COLOR_TIMER,
    COLOR_ORANGE, COLOR_CYAN, COLOR_PURPLE, INTERVIEW_DURATION,
)
from detector import fmt_time
from scoring import PostureCalibrator


def _score_color(score: float):
    if score >= 7.5:
        return COLOR_GREEN
    elif score >= 5.0:
        return COLOR_YELLOW
    return COLOR_RED


def _status_color(status: str):
    good = {"Straight", "Center", "Neutral", "Stable", "At Camera",
            "Smiling", "Open Palm", "Pointing"}
    warn = {"Slightly Slouched", "Moderate", "Active", "Calibrating",
            "Partial", "Blinking", "No Hands", "Forward", "Backward", "Tense"}
    if status in good:
        return COLOR_GREEN
    if status in warn:
        return COLOR_YELLOW
    return COLOR_RED


def _warn_color(warn_type: Optional[str]) -> tuple:
    """Return warning color based on severity."""
    if not warn_type:
        return (0, 100, 255)  # COLOR_WARN default
    high_warns = {"Eyes Closed", "Face Not Visible", "Heavy Slouch",
                  "Restless Behavior", "Nervous Movement"}
    if warn_type in high_warns:
        return (0, 60, 200)   # bright red (BGR)
    return (0, 100, 255)      # orange-red


def draw_meter(frame, x: int, y: int, width: int, height: int,
               value: float, max_val: float, color, label: str):
    """Draw a horizontal meter bar with label."""
    ratio  = min(value / max(max_val, 0.01), 1.0)
    filled = int(width * ratio)
    # Background
    cv2.rectangle(frame, (x, y), (x + width, y + height), (35, 35, 52), -1)
    # Filled portion
    if filled > 0:
        cv2.rectangle(frame, (x, y), (x + filled, y + height), color, -1)
    # Border
    cv2.rectangle(frame, (x, y), (x + width, y + height), (70, 70, 90), 1)
    # Label
    cv2.putText(frame, label, (x, y - 3), FONT, 0.35, COLOR_MUTED, 1, cv2.LINE_AA)


def draw_overlay(frame, data: dict, fps: float,
                 session_active: bool, elapsed: float,
                 remaining: float, overall_score: float,
                 warning: Optional[str], event_count: int,
                 calibrator: PostureCalibrator,
                 distraction_count: int = 0):

    h, w  = frame.shape[:2]
    PANEL = 308

    # Semi-transparent panel background
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (PANEL, h), COLOR_PANEL_BG, -1)
    cv2.addWeighted(overlay, 0.80, frame, 0.20, 0, frame)
    cv2.line(frame, (PANEL, 0), (PANEL, h), COLOR_DIVIDER, 1)

    # Header
    cv2.rectangle(frame, (0, 0), (PANEL, 46), COLOR_HEADER, -1)
    cv2.putText(frame, "INTERVIEW ANALYZER v4", (8, 30),
                FONT, 0.54, COLOR_ACCENT, 2, cv2.LINE_AA)

    fps_col = COLOR_GREEN if fps >= 20 else COLOR_YELLOW if fps >= 12 else COLOR_RED
    cv2.putText(frame, f"{fps:.0f}fps", (w - 95, 28),
                FONT, 0.56, fps_col, 2, cv2.LINE_AA)

    y = 54

    def section(title: str):
        nonlocal y
        cv2.putText(frame, title, (8, y), FONT, 0.38, COLOR_MUTED, 1, cv2.LINE_AA)
        y += 4
        cv2.line(frame, (8, y), (PANEL - 8, y), COLOR_DIVIDER, 1)
        y += 12

    def row(label: str, value: str, color=COLOR_WHITE):
        nonlocal y
        cv2.putText(frame, label,      (10, y),      FONT, 0.38, COLOR_MUTED, 1, cv2.LINE_AA)
        cv2.putText(frame, str(value), (10, y + 15), FONT, 0.52, color,       2, cv2.LINE_AA)
        y += 30

    def score_bar(lbl: str, score: float):
        nonlocal y
        bar_w  = PANEL - 20
        filled = int(bar_w * score / 10)
        col    = _score_color(score)
        cv2.putText(frame, f"{lbl}  {score:.1f}", (10, y),
                    FONT, 0.42, COLOR_WHITE, 1, cv2.LINE_AA)
        y += 5
        cv2.rectangle(frame, (10, y), (10 + bar_w, y + 7), (38, 38, 55), -1)
        if filled > 0:
            cv2.rectangle(frame, (10, y), (10 + filled, y + 7), col, -1)
        y += 15

    # ── Session block ──
    section("SESSION")
    if session_active:
        s_txt = "● RECORDING"
        s_col = COLOR_GREEN
    else:
        s_txt = "○ IDLE  [S] to Start"
        s_col = COLOR_YELLOW

    # Calibration indicator
    if session_active and not calibrator.calibrated:
        prog_pct = int(calibrator.progress * 100)
        s_txt    = f"◉ CALIBRATING {prog_pct}%"
        s_col    = COLOR_CYAN

    cv2.putText(frame, s_txt, (10, y), FONT, 0.48, s_col, 2, cv2.LINE_AA)
    y += 17
    remain_str = fmt_time(remaining) if INTERVIEW_DURATION > 0 else "∞"
    cv2.putText(frame,
                f"Elapsed {fmt_time(elapsed)}   Left {remain_str}",
                (10, y), FONT, 0.40, COLOR_TIMER, 1, cv2.LINE_AA)
    y += 14
    cv2.putText(frame, f"Events: {event_count}  Distractions: {distraction_count}",
                (10, y), FONT, 0.38, COLOR_MUTED, 1, cv2.LINE_AA)
    y += 20

    # ── Overall score ──
    section("OVERALL SCORE")
    oc     = _score_color(overall_score)
    bar_w  = PANEL - 20
    filled = int(bar_w * overall_score / 10)
    cv2.putText(frame, f"{overall_score:.1f} / 10", (10, y),
                FONT, 0.68, oc, 2, cv2.LINE_AA)
    y += 8
    cv2.rectangle(frame, (10, y), (10 + bar_w, y + 9), (38, 38, 55), -1)
    if filled > 0:
        cv2.rectangle(frame, (10, y), (10 + filled, y + 9), oc, -1)
    y += 18

    # ── Engagement / Attention meters ──
    section("LIVE METERS")
    eng  = data.get("s_engagement",  5.0)
    att  = data.get("s_attention",   5.0)
    draw_meter(frame, 10, y + 3, PANEL - 22, 7,
               eng, 10.0, COLOR_CYAN, "Engagement")
    y += 20
    draw_meter(frame, 10, y + 3, PANEL - 22, 7,
               att, 10.0, COLOR_ORANGE, "Attention")
    y += 20
    draw_meter(frame, 10, y + 3, PANEL - 22, 7,
               data.get("s_movement", 5.0), 10.0, COLOR_PURPLE, "Stability")
    y += 22

    # ── Warning panel ──
    if warning:
        warn_col = _warn_color(warning)
        cv2.rectangle(frame, (0, y - 2), (PANEL, y + 20), (0, 25, 70), -1)
        cv2.rectangle(frame, (0, y - 2), (PANEL, y + 20), warn_col, 1)
        cv2.putText(frame, f"⚠ {warning[:28]}", (7, y + 14),
                    FONT, 0.42, warn_col, 1, cv2.LINE_AA)
    y += 24

    # ── Live signals ──
    section("POSTURE")
    row("Status", data["posture_status"], _status_color(data["posture_status"]))
    y -= 4

    section("HEAD / GAZE")
    row("Head", data["lateral"],  _status_color(data["lateral"]))
    row("Gaze", data["gaze"],     _status_color(data["gaze"]))
    y -= 4

    section("EXPRESSION / GESTURE")
    row("Expr",    data["expression"], _status_color(data["expression"]))
    row("Gesture", data["gesture"],    _status_color(data["gesture"].split("/")[0].strip()))
    y -= 4

    section("MOVEMENT")
    row("Status", data["movement"], _status_color(data["movement"]))
    y += 2

    section("SCORES")
    score_bar("Posture  ", data["s_posture"])
    score_bar("Movement ", data["s_movement"])
    score_bar("Eye Cntct", data["s_eye"])
    score_bar("Expressn ", data["s_expression"])
    score_bar("Gesture  ", data["s_gesture"])

    hint_y = min(y + 4, h - 10)
    cv2.putText(frame, "[S] Start  [E] End+Report  [Q] Quit",
                (8, hint_y), FONT, 0.35, COLOR_MUTED, 1, cv2.LINE_AA)

    # ── Session quality indicator (top-right corner) ──
    q_labels = [(8.5, "EXCELLENT", COLOR_GREEN), (7.0, "GOOD", COLOR_GREEN),
                (5.5, "MODERATE",  COLOR_YELLOW), (0.0, "LOW",  COLOR_RED)]
    q_label, q_col = "LOW", COLOR_RED
    for threshold, lbl, col in q_labels:
        if overall_score >= threshold:
            q_label, q_col = lbl, col
            break
    cv2.putText(frame, f"Quality: {q_label}", (PANEL + 10, 30),
                FONT, 0.50, q_col, 2, cv2.LINE_AA)

    return frame
