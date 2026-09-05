"""
Behavior statistics, session aggregation, graph generation, scorecard,
and final report writing (TXT / JSON / PNG).

Extracted verbatim from the original main.py — no scoring, statistics,
or report content/format changes.
"""

import datetime
import json
import math
import os
from typing import Dict, List

import numpy as np

from config import REPORTS_DIR
from tracker import FrameLog, BehavioralEvent, TimelineTracker

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.gridspec as gridspec
    MATPLOTLIB_OK = True
except ImportError:
    MATPLOTLIB_OK = False
    print("[WARN] matplotlib not found - graph reports disabled.")


# ══════════════════════════════════════════════════════════════════
#  BEHAVIOR STATISTICS CLASS
# ══════════════════════════════════════════════════════════════════

class BehaviorStatistics:
    """
    Computes analytical statistics from session log data.
    Provides averages, standard deviations, variance, stability metrics.
    """

    @staticmethod
    def compute_series_stats(data: List[float]) -> Dict:
        if not data:
            return {"mean": 0, "std": 0, "min": 0, "max": 0,
                    "variance": 0, "volatility": 0, "stability_pct": 0}
        arr  = np.array(data, dtype=np.float64)
        mean = float(np.mean(arr))
        std  = float(np.std(arr))
        var  = float(np.var(arr))
        # volatility = normalized std relative to range
        rng  = float(np.ptp(arr))
        vol  = (std / max(rng, 0.1)) * 100
        # stability = % of time within 1 std of mean
        in_range = np.sum(np.abs(arr - mean) <= std)
        stab_pct = float(in_range / len(arr) * 100)
        return {
            "mean":          round(mean, 3),
            "std":           round(std,  3),
            "min":           round(float(np.min(arr)), 3),
            "max":           round(float(np.max(arr)), 3),
            "variance":      round(var,  5),
            "volatility":    round(vol,  2),
            "stability_pct": round(stab_pct, 1),
        }

    @classmethod
    def from_logs(cls, logs: List[FrameLog]) -> Dict:
        if not logs:
            return {}
        return {
            "posture":    cls.compute_series_stats([l.posture_score    for l in logs]),
            "movement":   cls.compute_series_stats([l.movement_score   for l in logs]),
            "eye":        cls.compute_series_stats([l.eye_score        for l in logs]),
            "expression": cls.compute_series_stats([l.expression_score for l in logs]),
            "gesture":    cls.compute_series_stats([l.gesture_score    for l in logs]),
            "engagement": cls.compute_series_stats([l.engagement_score for l in logs]),
            "attention":  cls.compute_series_stats([l.attention_score  for l in logs]),
            "gaze_attention": cls.compute_series_stats([l.gaze_attention for l in logs]),
            "composite_angle":cls.compute_series_stats([l.composite_angle for l in logs]),
            "variance":   cls.compute_series_stats([l.variance for l in logs]),
        }


# ══════════════════════════════════════════════════════════════════
#  SESSION AGGREGATION ENGINE
# ══════════════════════════════════════════════════════════════════

class SessionAggregator:

    @staticmethod
    def compute(logs: List[FrameLog], timeline: TimelineTracker,
                duration: float, events: List[BehavioralEvent]) -> dict:
        if not logs:
            return {}

        n = len(logs)
        stats = BehaviorStatistics.from_logs(logs)

        avg_posture    = stats["posture"]["mean"]
        avg_movement   = stats["movement"]["mean"]
        avg_eye        = stats["eye"]["mean"]
        avg_expression = stats["expression"]["mean"]
        avg_gesture    = stats["gesture"]["mean"]
        avg_engagement = stats["engagement"]["mean"]
        avg_attention  = stats["attention"]["mean"]
        avg_overall    = round((avg_posture + avg_movement + avg_eye +
                                avg_expression + avg_gesture) / 5, 2)

        pct_straight  = round(sum(1 for l in logs if l.posture    == "Straight")  / n * 100, 1)
        pct_at_camera = round(sum(1 for l in logs if l.gaze       == "At Camera") / n * 100, 1)
        pct_stable    = round(sum(1 for l in logs if l.movement   == "Stable")    / n * 100, 1)
        pct_restless  = round(sum(1 for l in logs if l.movement   == "Restless")  / n * 100, 1)
        pct_smiling   = round(sum(1 for l in logs if l.expression == "Smiling")   / n * 100, 1)
        pct_neutral   = round(sum(1 for l in logs if l.expression == "Neutral")   / n * 100, 1)
        pct_open_palm = round(sum(1 for l in logs if "Open Palm" in l.gesture)    / n * 100, 1)
        pct_no_hands  = round(sum(1 for l in logs if l.gesture    == "No Hands")  / n * 100, 1)
        pct_down_gaze = round(sum(1 for l in logs if l.gaze == "Looking Down")    / n * 100, 1)
        avg_spine     = stats["composite_angle"]["mean"]
        avg_gaze_att  = stats["gaze_attention"]["mean"]

        event_counts: Dict[str, int] = {}
        for ev in events:
            event_counts[ev.event_type] = event_counts.get(ev.event_type, 0) + 1

        all_scores = {
            "posture":    avg_posture,
            "movement":   avg_movement,
            "eye_contact":avg_eye,
            "expression": avg_expression,
            "gesture":    avg_gesture,
        }
        strongest = max(all_scores, key=all_scores.get)
        weakest   = min(all_scores, key=all_scores.get)

        # Behavioral presence score (composite with engagement weight)
        behavioral_presence = round(
            avg_overall * 0.6 + avg_engagement * 0.25 + avg_attention * 0.15, 2)

        return {
            "duration_seconds":    round(duration, 1),
            "total_log_entries":   n,
            "avg_scores": {
                "posture":    round(avg_posture,    2),
                "movement":   round(avg_movement,   2),
                "eye_contact":round(avg_eye,        2),
                "expression": round(avg_expression, 2),
                "gesture":    round(avg_gesture,    2),
                "overall":    avg_overall,
                "engagement": round(avg_engagement, 2),
                "attention":  round(avg_attention,  2),
            },
            "percentages": {
                "straight_posture_pct":   pct_straight,
                "at_camera_gaze_pct":     pct_at_camera,
                "stable_movement_pct":    pct_stable,
                "restless_movement_pct":  pct_restless,
                "smiling_pct":            pct_smiling,
                "neutral_expression_pct": pct_neutral,
                "open_palm_gesture_pct":  pct_open_palm,
                "no_hands_visible_pct":   pct_no_hands,
                "downward_gaze_pct":      pct_down_gaze,
                "avg_gaze_attention":     round(avg_gaze_att, 3),
            },
            "statistics":           stats,
            "avg_spine_angle":      avg_spine,
            "strongest_signal":     strongest,
            "weakest_signal":       weakest,
            "behavioral_presence":  behavioral_presence,
            "event_counts":         event_counts,
            "total_events":         len(events),
            "trends": {
                "posture":    timeline.trend(timeline.posture),
                "movement":   timeline.trend(timeline.movement),
                "eye":        timeline.trend(timeline.eye),
                "overall":    timeline.trend(timeline.overall),
                "engagement": timeline.trend(timeline.engagement),
                "attention":  timeline.trend(timeline.attention),
            },
        }


# ══════════════════════════════════════════════════════════════════
#  GRAPH GENERATOR (matplotlib)
# ══════════════════════════════════════════════════════════════════

class GraphGenerator:
    """
    Generates professional dark-theme PNG graphs from session data.
    Saved automatically into reports/session_<ts>/
    """

    DARK_BG    = "#0d0d1a"
    GRID_COLOR = "#2a2a40"
    LINE_COLORS = {
        "overall":    "#00e87a",
        "posture":    "#00c8f5",
        "eye":        "#f5a623",
        "movement":   "#e052e0",
        "engagement": "#52d4e0",
        "attention":  "#e07852",
    }

    @classmethod
    def generate_all(cls, timeline: TimelineTracker, agg: dict,
                     events: List[BehavioralEvent], out_dir: str):
        if not MATPLOTLIB_OK:
            print("[WARN] matplotlib unavailable - skipping graphs.")
            return []

        os.makedirs(out_dir, exist_ok=True)
        paths = []

        paths.append(cls._timeline_dashboard(timeline, agg, out_dir))
        paths.append(cls._posture_detail(timeline, agg, out_dir))
        paths.append(cls._gaze_movement(timeline, agg, out_dir))
        paths.append(cls._engagement_attention(timeline, agg, out_dir))
        paths.append(cls._event_timeline(events, timeline, out_dir))
        paths.append(cls._scorecard_radar(agg, out_dir))

        return [p for p in paths if p]

    @classmethod
    def _setup_ax(cls, ax, title: str):
        ax.set_facecolor(cls.DARK_BG)
        ax.set_title(title, color="#ccccdd", fontsize=10, pad=8, fontweight="bold")
        ax.tick_params(colors="#888899", labelsize=8)
        ax.spines[:].set_color(cls.GRID_COLOR)
        ax.grid(True, color=cls.GRID_COLOR, linewidth=0.6, alpha=0.7)
        ax.set_ylim(0, 10.5)
        ax.set_ylabel("Score (0–10)", color="#888899", fontsize=8)
        ax.set_xlabel("Time (s)", color="#888899", fontsize=8)

    @classmethod
    def _add_avg_line(cls, ax, arr: List[float], color: str):
        if arr:
            avg = float(np.mean(arr))
            ax.axhline(avg, color=color, linewidth=1.0,
                       linestyle="--", alpha=0.6, label=f"Avg {avg:.1f}")

    @classmethod
    def _timeline_dashboard(cls, tl: TimelineTracker, agg: dict, out_dir: str) -> str:
        fig = plt.figure(figsize=(14, 8), facecolor=cls.DARK_BG)
        fig.suptitle("Session Overview — All Scores", color="#ffffff",
                     fontsize=13, fontweight="bold", y=0.97)

        gs = gridspec.GridSpec(2, 3, figure=fig, hspace=0.48, wspace=0.35,
                               left=0.07, right=0.97, top=0.91, bottom=0.09)

        plots = [
            (0, 0, "Overall Score",    tl.overall,    "overall"),
            (0, 1, "Posture Score",    tl.posture,    "posture"),
            (0, 2, "Eye Contact",      tl.eye,        "eye"),
            (1, 0, "Movement Stability",tl.movement,  "movement"),
            (1, 1, "Engagement",       tl.engagement, "engagement"),
            (1, 2, "Attention",        tl.attention,  "attention"),
        ]

        for row, col, title, data, key in plots:
            ax = fig.add_subplot(gs[row, col])
            cls._setup_ax(ax, title)
            if tl.times and data:
                color = cls.LINE_COLORS[key]
                ax.plot(tl.times, data, color=color, linewidth=1.6,
                        alpha=0.9, label=title)
                # Smoothed trend line
                if len(data) > 8:
                    smooth = np.convolve(data, np.ones(8)/8, mode="valid")
                    t_trim = tl.times[7:][:len(smooth)]
                    ax.plot(t_trim, smooth, color=color, linewidth=2.5,
                            alpha=0.5, linestyle="-")
                cls._add_avg_line(ax, data, color)
                ax.legend(fontsize=7, loc="lower right",
                          facecolor=cls.DARK_BG, labelcolor="#ccccdd",
                          framealpha=0.6)

        path = os.path.join(out_dir, "01_overview_dashboard.png")
        fig.savefig(path, dpi=120, bbox_inches="tight",
                    facecolor=cls.DARK_BG)
        plt.close(fig)
        return path

    @classmethod
    def _posture_detail(cls, tl: TimelineTracker, agg: dict, out_dir: str) -> str:
        fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), facecolor=cls.DARK_BG)
        fig.suptitle("Posture Analysis", color="#ffffff",
                     fontsize=12, fontweight="bold")

        ax1, ax2 = axes

        # Posture score timeline
        cls._setup_ax(ax1, "Posture Score Over Time")
        if tl.times and tl.posture:
            col = cls.LINE_COLORS["posture"]
            ax1.fill_between(tl.times, tl.posture, alpha=0.15, color=col)
            ax1.plot(tl.times, tl.posture, color=col, linewidth=1.8)
            cls._add_avg_line(ax1, tl.posture, col)
            # Threshold lines
            ax1.axhline(7.5, color="#00e87a", linewidth=0.8,
                        linestyle=":", alpha=0.5, label="Good threshold")
            ax1.axhline(5.0, color="#f5a623", linewidth=0.8,
                        linestyle=":", alpha=0.5, label="Moderate threshold")
            ax1.legend(fontsize=7, facecolor=cls.DARK_BG, labelcolor="#ccccdd")

        # Posture distribution pie
        ax2.set_facecolor(cls.DARK_BG)
        ax2.set_title("Posture Distribution", color="#ccccdd",
                      fontsize=10, pad=8, fontweight="bold")
        p = agg.get("percentages", {})
        straight = p.get("straight_posture_pct", 50)
        rest     = max(100 - straight, 0)
        wedge_colors = ["#00e87a", "#e05252"]
        wedges, texts, autotexts = ax2.pie(
            [straight, rest],
            labels=["Straight", "Non-Straight"],
            colors=wedge_colors, autopct="%1.1f%%",
            startangle=90, textprops={"color": "#ccccdd", "fontsize": 9})
        for at in autotexts:
            at.set_color("#ffffff")
            at.set_fontsize(9)

        for ax in axes:
            ax.spines[:].set_color(cls.GRID_COLOR)

        path = os.path.join(out_dir, "02_posture_detail.png")
        fig.tight_layout(rect=[0, 0, 1, 0.95])
        fig.savefig(path, dpi=120, bbox_inches="tight", facecolor=cls.DARK_BG)
        plt.close(fig)
        return path

    @classmethod
    def _gaze_movement(cls, tl: TimelineTracker, agg: dict, out_dir: str) -> str:
        fig, axes = plt.subplots(2, 1, figsize=(12, 7), facecolor=cls.DARK_BG,
                                 sharex=True)
        fig.suptitle("Eye Contact & Movement Analysis", color="#ffffff",
                     fontsize=12, fontweight="bold")

        ax1, ax2 = axes

        cls._setup_ax(ax1, "Eye Contact Score")
        if tl.times and tl.eye:
            col = cls.LINE_COLORS["eye"]
            ax1.fill_between(tl.times, tl.eye, alpha=0.12, color=col)
            ax1.plot(tl.times, tl.eye, color=col, linewidth=1.8, label="Eye Contact")
            cls._add_avg_line(ax1, tl.eye, col)
            ax1.legend(fontsize=8, facecolor=cls.DARK_BG, labelcolor="#ccccdd")

        cls._setup_ax(ax2, "Movement Stability Score")
        if tl.times and tl.movement:
            col = cls.LINE_COLORS["movement"]
            ax2.fill_between(tl.times, tl.movement, alpha=0.12, color=col)
            ax2.plot(tl.times, tl.movement, color=col, linewidth=1.8, label="Movement")
            cls._add_avg_line(ax2, tl.movement, col)
            ax2.legend(fontsize=8, facecolor=cls.DARK_BG, labelcolor="#ccccdd")
            ax2.set_xlabel("Time (s)", color="#888899", fontsize=8)

        fig.tight_layout(rect=[0, 0, 1, 0.95])
        path = os.path.join(out_dir, "03_gaze_movement.png")
        fig.savefig(path, dpi=120, bbox_inches="tight", facecolor=cls.DARK_BG)
        plt.close(fig)
        return path

    @classmethod
    def _engagement_attention(cls, tl: TimelineTracker, agg: dict, out_dir: str) -> str:
        fig, ax = plt.subplots(figsize=(12, 4.5), facecolor=cls.DARK_BG)
        fig.suptitle("Engagement & Attention Timeline", color="#ffffff",
                     fontsize=12, fontweight="bold")

        cls._setup_ax(ax, "Engagement vs Attention")
        if tl.times:
            if tl.engagement:
                col = cls.LINE_COLORS["engagement"]
                ax.plot(tl.times, tl.engagement, color=col, linewidth=2.0,
                        label="Engagement", alpha=0.9)
                cls._add_avg_line(ax, tl.engagement, col)
            if tl.attention:
                col = cls.LINE_COLORS["attention"]
                ax.plot(tl.times, tl.attention, color=col, linewidth=2.0,
                        label="Attention", alpha=0.9, linestyle="--")
                cls._add_avg_line(ax, tl.attention, col)
            ax.legend(fontsize=9, facecolor=cls.DARK_BG, labelcolor="#ccccdd",
                      loc="lower right")

        path = os.path.join(out_dir, "04_engagement_attention.png")
        fig.tight_layout(rect=[0, 0, 1, 0.95])
        fig.savefig(path, dpi=120, bbox_inches="tight", facecolor=cls.DARK_BG)
        plt.close(fig)
        return path

    @classmethod
    def _event_timeline(cls, events: List[BehavioralEvent],
                        tl: TimelineTracker, out_dir: str) -> str:
        fig, ax = plt.subplots(figsize=(13, 3.5), facecolor=cls.DARK_BG)
        ax.set_facecolor(cls.DARK_BG)
        ax.set_title("Behavioral Events Timeline", color="#ccccdd",
                     fontsize=10, pad=8, fontweight="bold")
        ax.spines[:].set_color(cls.GRID_COLOR)
        ax.grid(True, color=cls.GRID_COLOR, linewidth=0.6, alpha=0.5, axis="x")

        if tl.overall:
            ax.plot(tl.times, tl.overall, color="#00e87a", linewidth=1.0,
                    alpha=0.3, label="Overall Score (background)")

        sev_colors = {"high": "#e05252", "medium": "#f5a623", "low": "#52d4e0"}
        if events:
            y_labels = []
            y_pos    = []
            for i, ev in enumerate(events):
                col = sev_colors.get(ev.severity, "#ccccdd")
                ax.axvline(ev.time, color=col, linewidth=1.2, alpha=0.8)
                ax.text(ev.time, 10.2 - (i % 3) * 0.6,
                        ev.event_type[:18], color=col, fontsize=6,
                        rotation=45, ha="left", va="bottom")

        ax.set_xlim(left=0)
        ax.set_ylim(0, 12)
        ax.set_xlabel("Time (s)", color="#888899", fontsize=8)
        ax.tick_params(colors="#888899", labelsize=8)
        # Legend for severities
        from matplotlib.lines import Line2D
        legend_elements = [
            Line2D([0], [0], color="#e05252", linewidth=2, label="High severity"),
            Line2D([0], [0], color="#f5a623", linewidth=2, label="Medium severity"),
            Line2D([0], [0], color="#52d4e0", linewidth=2, label="Low severity"),
        ]
        ax.legend(handles=legend_elements, fontsize=7, facecolor=cls.DARK_BG,
                  labelcolor="#ccccdd", loc="upper right")

        path = os.path.join(out_dir, "05_event_timeline.png")
        fig.tight_layout()
        fig.savefig(path, dpi=120, bbox_inches="tight", facecolor=cls.DARK_BG)
        plt.close(fig)
        return path

    @classmethod
    def _scorecard_radar(cls, agg: dict, out_dir: str) -> str:
        """Generates a spider/radar chart of category scores."""
        avg  = agg.get("avg_scores", {})
        cats = ["Posture", "Eye Contact", "Movement", "Expression",
                "Gesture", "Engagement", "Attention"]
        vals = [
            avg.get("posture",    5),
            avg.get("eye_contact",5),
            avg.get("movement",   5),
            avg.get("expression", 5),
            avg.get("gesture",    5),
            avg.get("engagement", 5),
            avg.get("attention",  5),
        ]
        # Close the polygon
        vals += vals[:1]
        N     = len(cats)
        angles= [n / float(N) * 2 * math.pi for n in range(N)]
        angles += angles[:1]

        fig, ax = plt.subplots(figsize=(7, 7), facecolor=cls.DARK_BG,
                               subplot_kw=dict(polar=True))
        ax.set_facecolor("#0d0d25")
        fig.suptitle("Performance Radar", color="#ffffff",
                     fontsize=12, fontweight="bold", y=0.98)

        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(cats, color="#ccccdd", size=9)
        ax.set_rlabel_position(30)
        ax.set_yticks([2, 4, 6, 8, 10])
        ax.set_yticklabels(["2", "4", "6", "8", "10"],
                           color="#666677", size=7)
        ax.set_ylim(0, 10)
        ax.grid(color=cls.GRID_COLOR, linewidth=0.7)
        ax.spines["polar"].set_color(cls.GRID_COLOR)

        ax.plot(angles, vals, color="#00e87a", linewidth=2.0,
                linestyle="solid", alpha=0.9)
        ax.fill(angles, vals, color="#00e87a", alpha=0.18)

        # Reference circle at 7.5
        ref_vals = [7.5] * (N + 1)
        ax.plot(angles, ref_vals, color="#f5a623", linewidth=1.0,
                linestyle="--", alpha=0.5, label="Good threshold (7.5)")
        ax.legend(fontsize=8, loc="upper right", bbox_to_anchor=(1.3, 1.15),
                  facecolor=cls.DARK_BG, labelcolor="#ccccdd")

        path = os.path.join(out_dir, "06_radar_scorecard.png")
        fig.savefig(path, dpi=120, bbox_inches="tight", facecolor=cls.DARK_BG)
        plt.close(fig)
        return path


# ══════════════════════════════════════════════════════════════════
#  INTERVIEW SCORECARD GENERATOR
# ══════════════════════════════════════════════════════════════════

class InterviewScorecard:

    @staticmethod
    def grade(score: float):
        if score >= 9.0:  return "A+", "Exceptional"
        if score >= 8.0:  return "A",  "Excellent"
        if score >= 7.0:  return "B+", "Very Good"
        if score >= 6.5:  return "B",  "Good"
        if score >= 5.5:  return "C+", "Above Average"
        if score >= 5.0:  return "C",  "Moderate"
        if score >= 4.0:  return "D",  "Below Average"
        return "F", "Needs Improvement"

    @classmethod
    def interpret_posture(cls, score: float, pct_straight: float) -> str:
        if pct_straight >= 75:
            return (f"Maintained upright posture for {pct_straight:.0f}% of the session. "
                    "Strong postural discipline observed.")
        elif pct_straight >= 55:
            return (f"Maintained upright posture for {pct_straight:.0f}% of the session. "
                    "Moderate postural consistency with some deviation periods.")
        else:
            return (f"Upright posture was observed for {pct_straight:.0f}% of the session. "
                    "Significant postural variability noted — consider seated alignment awareness.")

    @classmethod
    def interpret_eye(cls, score: float, pct_camera: float) -> str:
        if pct_camera >= 70:
            return (f"Camera-directed gaze maintained {pct_camera:.0f}% of session. "
                    "Strong eye contact engagement signals observed.")
        elif pct_camera >= 45:
            return (f"Camera engagement at {pct_camera:.0f}% — moderate attention consistency. "
                    "Some distraction or gaze drift periods detected.")
        else:
            return (f"Camera-directed gaze at {pct_camera:.0f}% of session. "
                    "Low eye engagement signals — frequent gaze breaks noted.")

    @classmethod
    def interpret_movement(cls, score: float, pct_stable: float, pct_restless: float) -> str:
        if pct_stable >= 70:
            return (f"Body stability observed for {pct_stable:.0f}% of session. "
                    "Composed and controlled movement signals throughout.")
        elif pct_restless > 30:
            return (f"Elevated movement variance detected. Restless movement signals "
                    f"in {pct_restless:.0f}% of observations — may indicate physical discomfort.")
        else:
            return (f"Movement stability at {pct_stable:.0f}%. "
                    "Moderate movement variance with occasional activity spikes.")

    @classmethod
    def identify_strengths(cls, avg_scores: dict) -> List[str]:
        strengths = []
        label_map = {
            "posture":    "Posture & Physical Presence",
            "eye_contact":"Eye Contact & Camera Engagement",
            "movement":   "Movement Stability & Composure",
            "expression": "Facial Expression & Engagement Signals",
            "gesture":    "Hand Gesture Communication",
            "engagement": "Overall Behavioral Engagement",
            "attention":  "Attention & Focus Consistency",
        }
        for key, score in avg_scores.items():
            if score >= 7.5:
                strengths.append(f"{label_map.get(key, key)}: {score:.1f}/10")
        return strengths[:4]

    @classmethod
    def identify_improvements(cls, avg_scores: dict) -> List[str]:
        improvements = []
        advice_map = {
            "posture":     "Practice maintaining upright seated posture during mock interviews.",
            "eye_contact": "Focus on maintaining consistent camera gaze to simulate eye contact.",
            "movement":    "Minimize unnecessary body movement — practice stillness exercises.",
            "expression":  "Work on maintaining engaged and expressive facial signals.",
            "gesture":     "Use open-palm, deliberate hand gestures to reinforce communication.",
            "engagement":  "Practice active engagement techniques: nodding, leaning slightly forward.",
            "attention":   "Reduce environmental distractions; practice focused attention drills.",
        }
        for key, score in avg_scores.items():
            if score < 6.0:
                improvements.append(f"{key.replace('_', ' ').title()}: {advice_map.get(key, '')}")
        return improvements[:4]

    @classmethod
    def generate(cls, agg: dict, events: List[BehavioralEvent],
                 stats: dict) -> str:
        SEP  = "═" * 66
        sep2 = "─" * 66

        avg = agg.get("avg_scores",  {})
        p   = agg.get("percentages", {})
        t   = agg.get("trends",      {})
        dur = agg.get("duration_seconds", 0)

        overall    = avg.get("overall", 0)
        g_letter, g_label = cls.grade(overall)
        bp         = agg.get("behavioral_presence", overall)

        strengths   = cls.identify_strengths(avg)
        improvements= cls.identify_improvements(avg)

        def fmt_t(s: float) -> str:
            return f"{int(s)//60:02d}:{int(s)%60:02d}"

        lines = [
            SEP,
            "    ★  AI INTERVIEW BEHAVIORAL PERFORMANCE SCORECARD  ★",
            SEP,
            "",
            f"  Overall Behavioral Grade     : {g_letter}  —  {g_label}",
            f"  Overall Score                : {overall:.1f} / 10",
            f"  Behavioral Presence Score    : {bp:.1f} / 10",
            f"  Session Duration             : {fmt_t(dur)}",
            f"  Total Behavioral Events      : {agg.get('total_events', 0)}",
            "",
            sep2,
            "  CATEGORY SCORECARD",
            sep2,
        ]

        categories = [
            ("Posture",          "posture",     "B"),
            ("Eye Contact",      "eye_contact", "C"),
            ("Movement Stability","movement",   "D"),
            ("Facial Expression","expression",  "E"),
            ("Gesture Communication","gesture", "F"),
            ("Engagement",       "engagement",  "G"),
            ("Attention Focus",  "attention",   "H"),
        ]

        for label, key, ref in categories:
            sc = avg.get(key, 0)
            gl, gn = cls.grade(sc)
            bar = "█" * int(sc) + "░" * (10 - int(sc))
            trend = t.get(key.split("_")[0], "—")
            lines.append(
                f"  {label:<24} {sc:5.1f}/10  [{bar}]  {gl:3s} ({gn[:16]:<16})  ↑ {trend}")

        lines += [
            "",
            sep2,
            "  DETAILED INTERPRETATIONS",
            sep2,
            "",
            "  POSTURE:",
            f"    {cls.interpret_posture(avg.get('posture',0), p.get('straight_posture_pct',0))}",
            "",
            "  EYE CONTACT:",
            f"    {cls.interpret_eye(avg.get('eye_contact',0), p.get('at_camera_gaze_pct',0))}",
            "",
            "  MOVEMENT:",
            f"    {cls.interpret_movement(avg.get('movement',0), p.get('stable_movement_pct',0), p.get('restless_movement_pct',0))}",
            "",
        ]

        lines += [sep2, "  IDENTIFIED STRENGTHS", sep2]
        if strengths:
            for s in strengths:
                lines.append(f"  ✓  {s}")
        else:
            lines.append("  No standout strengths above threshold this session.")

        lines += ["", sep2, "  AREAS FOR IMPROVEMENT", sep2]
        if improvements:
            for imp in improvements:
                lines.append(f"  →  {imp}")
        else:
            lines.append("  Strong overall performance — continue current practice.")

        # Statistical highlights
        lines += ["", sep2, "  STATISTICAL HIGHLIGHTS", sep2]
        st = agg.get("statistics", {})
        for key in ["posture", "eye", "movement", "engagement"]:
            s = st.get(key, {})
            if s:
                lbl = key.replace("_", " ").title()
                lines.append(
                    f"  {lbl:<20}  avg={s.get('mean',0):.2f}  "
                    f"σ={s.get('std',0):.2f}  "
                    f"stability={s.get('stability_pct',0):.0f}%  "
                    f"volatility={s.get('volatility',0):.1f}%")

        lines += ["", sep2, "  BEHAVIORAL EVENTS SUMMARY", sep2]
        ec = agg.get("event_counts", {})
        if ec:
            for etype, cnt in sorted(ec.items(), key=lambda x: -x[1]):
                lines.append(f"  {etype:<35} ×{cnt}")
        else:
            lines.append("  No significant behavioral events recorded.")

        lines += ["", SEP, "  END OF SCORECARD", SEP]
        return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════
#  REPORT GENERATOR  (fully upgraded)
# ══════════════════════════════════════════════════════════════════

class ReportGenerator:

    @staticmethod
    def _fmt(seconds: float) -> str:
        return f"{int(seconds)//60:02d}:{int(seconds)%60:02d}"

    @staticmethod
    def generate_txt(agg: dict, events: List[BehavioralEvent],
                     timeline: TimelineTracker, timestamp: str) -> str:
        SEP  = "═" * 66
        sep2 = "─" * 66
        p    = agg.get("percentages", {})
        avg  = agg.get("avg_scores",  {})
        t    = agg.get("trends",      {})
        dur  = agg.get("duration_seconds", 0)
        stats= agg.get("statistics",  {})

        def grade(score):
            if score >= 8.0:  return "Excellent"
            if score >= 6.5:  return "Good"
            if score >= 5.0:  return "Moderate"
            return "Needs Improvement"

        lines = [
            SEP,
            "    AI INTERVIEW BEHAVIOR ANALYZER — SESSION REPORT",
            f"    Generated : {timestamp}",
            f"    Duration  : {ReportGenerator._fmt(dur)}  ({dur:.0f}s)",
            SEP,
            "",
            "  ⚠  DISCLAIMER",
            "  This report documents observable behavioral signals only.",
            "  It does not assess personality, honesty, or psychological state.",
            "",
            sep2,
            "  A.  OVERALL SUMMARY",
            sep2,
            f"  Overall Behavioral Score     : {avg.get('overall',0):.1f} / 10  ({grade(avg.get('overall',0))})",
            f"  Behavioral Presence Score    : {agg.get('behavioral_presence',0):.1f} / 10",
            f"  Engagement Score             : {avg.get('engagement',0):.1f} / 10",
            f"  Attention Score              : {avg.get('attention',0):.1f} / 10",
            f"  Overall Session Trend        : {t.get('overall','N/A').upper()}",
            f"  Strongest Signal Area        : {agg.get('strongest_signal','N/A').title()}",
            f"  Weakest  Signal Area         : {agg.get('weakest_signal','N/A').title()}",
            f"  Total Behavioral Events      : {agg.get('total_events', 0)}",
            f"  Log Entries Captured         : {agg.get('total_log_entries',0)}",
            "",
            sep2,
            "  B.  POSTURE ANALYSIS",
            sep2,
            f"  Score                        : {avg.get('posture',0):.1f}/10  ({grade(avg.get('posture',0))})",
            f"  Upright Posture              : {p.get('straight_posture_pct',0):.1f}% of session",
            f"  Avg Composite Spine Angle    : {agg.get('avg_spine_angle',0):.1f}°",
            f"  Score Trend                  : {t.get('posture','N/A').upper()}",
        ]
        ps = stats.get("posture", {})
        if ps:
            lines += [
                f"  Score Std Deviation          : {ps.get('std',0):.2f}",
                f"  Score Volatility             : {ps.get('volatility',0):.1f}%",
                f"  Score Stability              : {ps.get('stability_pct',0):.0f}% within 1σ",
            ]
        lines += [
            f"  Interpretation               : Candidate displayed behavioral signals",
            f"    associated with upright posture for {p.get('straight_posture_pct',0):.1f}%",
            f"    of the session duration.",
            "",
            sep2,
            "  C.  EYE CONTACT ANALYSIS",
            sep2,
            f"  Score                        : {avg.get('eye_contact',0):.1f}/10  ({grade(avg.get('eye_contact',0))})",
            f"  Camera-Directed Gaze         : {p.get('at_camera_gaze_pct',0):.1f}% of session",
            f"  Downward Gaze Frequency      : {p.get('downward_gaze_pct',0):.1f}% of session",
            f"  Avg Gaze Attention Index     : {p.get('avg_gaze_attention',0)*100:.1f}%",
            f"  Score Trend                  : {t.get('eye','N/A').upper()}",
        ]
        es = stats.get("eye", {})
        if es:
            lines += [
                f"  Score Std Deviation          : {es.get('std',0):.2f}",
                f"  Stability                    : {es.get('stability_pct',0):.0f}%",
            ]
        lines += [
            f"  Interpretation               : Eye contact engagement signals were",
            f"    {'strong' if p.get('at_camera_gaze_pct',0)>60 else 'moderate' if p.get('at_camera_gaze_pct',0)>40 else 'limited'}"
            f" relative to total session time.",
            "",
            sep2,
            "  D.  EXPRESSION ANALYSIS",
            sep2,
            f"  Score                        : {avg.get('expression',0):.1f}/10  ({grade(avg.get('expression',0))})",
            f"  Smiling Detected             : {p.get('smiling_pct',0):.1f}% of session",
            f"  Neutral Expression           : {p.get('neutral_expression_pct',0):.1f}% of session",
            f"  Interpretation               : Candidate displayed primarily",
            f"    {'engaged (smiling)' if p.get('smiling_pct',0)>20 else 'composed (neutral)'}",
            f"    facial behavioral signals.",
            "",
            sep2,
            "  E.  GESTURE ANALYSIS",
            sep2,
            f"  Score                        : {avg.get('gesture',0):.1f}/10  ({grade(avg.get('gesture',0))})",
            f"  Open Palm Gestures           : {p.get('open_palm_gesture_pct',0):.1f}% of session",
            f"  Hands Not Visible            : {p.get('no_hands_visible_pct',0):.1f}% of session",
            f"  Interpretation               : Open-hand gesture signals are associated",
            f"    with communicative engagement indicators.",
            "",
            sep2,
            "  F.  MOVEMENT ANALYSIS",
            sep2,
            f"  Score                        : {avg.get('movement',0):.1f}/10  ({grade(avg.get('movement',0))})",
            f"  Stable Movement              : {p.get('stable_movement_pct',0):.1f}% of session",
            f"  Restless Movement            : {p.get('restless_movement_pct',0):.1f}% of session",
            f"  Score Trend                  : {t.get('movement','N/A').upper()}",
        ]
        ms = stats.get("movement", {})
        if ms:
            lines += [
                f"  Movement Volatility          : {ms.get('volatility',0):.1f}%",
                f"  Stability Score              : {ms.get('stability_pct',0):.0f}%",
            ]
        lines += [
            f"  Interpretation               : {'High movement stability signals observed.' if p.get('stable_movement_pct',0)>60 else 'Moderate or elevated movement variance detected.'}",
            "",
            sep2,
            "  G.  BEHAVIORAL EVENTS TIMELINE",
            sep2,
        ]

        if events:
            for ev in events:
                sev_tag = f"[{ev.severity.upper()}]"
                lines.append(f"  {ReportGenerator._fmt(ev.time)}  {sev_tag:<8} [{ev.event_type}]")
                lines.append(f"              {ev.detail}")
        else:
            lines.append("  No significant behavioral events detected.")

        lines += [
            "",
            sep2,
            "  H.  STATISTICAL SUMMARY",
            sep2,
            f"  {'Metric':<20} {'Mean':>7} {'Std':>7} {'Min':>7} {'Max':>7} {'Stability':>10}",
            f"  {'─'*20}  {'─'*7} {'─'*7} {'─'*7} {'─'*7} {'─'*10}",
        ]
        for key in ["posture", "eye", "movement", "expression", "gesture", "engagement", "attention"]:
            s = stats.get(key, {})
            if s:
                lbl = key.replace("_", " ").title()
                lines.append(
                    f"  {lbl:<20} {s.get('mean',0):>7.2f} {s.get('std',0):>7.2f} "
                    f"{s.get('min',0):>7.2f} {s.get('max',0):>7.2f} "
                    f"{s.get('stability_pct',0):>9.0f}%")

        lines += [
            "",
            sep2,
            "  I.  SCORE SUMMARY TABLE",
            sep2,
            f"  {'Category':<24} {'Avg Score':>10}   {'Grade':<20} {'Trend'}",
            f"  {'─'*24}  {'─'*10}   {'─'*20} {'─'*10}",
            f"  {'Posture':<24} {avg.get('posture',0):>9.1f}/10   {grade(avg.get('posture',0)):<20} {t.get('posture','N/A')}",
            f"  {'Movement':<24} {avg.get('movement',0):>9.1f}/10   {grade(avg.get('movement',0)):<20} {t.get('movement','N/A')}",
            f"  {'Eye Contact':<24} {avg.get('eye_contact',0):>9.1f}/10   {grade(avg.get('eye_contact',0)):<20} {t.get('eye','N/A')}",
            f"  {'Expression':<24} {avg.get('expression',0):>9.1f}/10   {grade(avg.get('expression',0)):<20} —",
            f"  {'Gesture':<24} {avg.get('gesture',0):>9.1f}/10   {grade(avg.get('gesture',0)):<20} —",
            f"  {'Engagement':<24} {avg.get('engagement',0):>9.1f}/10   {grade(avg.get('engagement',0)):<20} {t.get('engagement','N/A')}",
            f"  {'Attention':<24} {avg.get('attention',0):>9.1f}/10   {grade(avg.get('attention',0)):<20} {t.get('attention','N/A')}",
            f"  {'─'*24}  {'─'*10}   {'─'*20} {'─'*10}",
            f"  {'OVERALL':<24} {avg.get('overall',0):>9.1f}/10   {grade(avg.get('overall',0)):<20} {t.get('overall','N/A')}",
            "",
            SEP,
            "  END OF REPORT",
            SEP,
        ]
        return "\n".join(lines)

    @staticmethod
    def save(agg: dict, events: List[BehavioralEvent],
             timeline: TimelineTracker, logs: List[FrameLog]):
        # ── Issue 2 diagnostics (Phase 3C.3) ──────────────────────────
        # Pure instrumentation: start/done/error markers with elapsed ms
        # around each stage, plus the absolute session dir path. No
        # report content, format, or calculation logic below is changed
        # — every stage does exactly what it did before, these are only
        # print()s and a try/except wrapper around the whole method.
        # These markers double as a liveness signal for the Node-side
        # inactivity-based SIGKILL fallback (behavior-engine.service.ts):
        # a process still printing "start"/"done" lines is still making
        # progress and won't be killed.
        import time as _time

        def _stage_start(name: str) -> float:
            print(f"[BEHAVIOR_ENGINE_REPORT_STAGE] {name} - start")
            return _time.monotonic()

        def _stage_done(name: str, t0: float) -> None:
            elapsed_ms = round((_time.monotonic() - t0) * 1000, 1)
            print(f"[BEHAVIOR_ENGINE_REPORT_STAGE] {name} - done ({elapsed_ms}ms)")

        save_t0 = _time.monotonic()
        try:
            ts       = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            ts_human = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # mkdir
            t0 = _stage_start("mkdir")
            session_dir  = os.path.join(REPORTS_DIR, f"session_{ts}")
            os.makedirs(session_dir, exist_ok=True)
            print(f"[BEHAVIOR_ENGINE_REPORT_STAGE] session dir (absolute) -> {os.path.abspath(session_dir)}")
            _stage_done("mkdir", t0)

            txt_path      = os.path.join(session_dir, "report.txt")
            json_path     = os.path.join(session_dir, "report.json")
            scorecard_path= os.path.join(session_dir, "scorecard.txt")

            # TXT report
            t0 = _stage_start("txt")
            txt_content = ReportGenerator.generate_txt(agg, events, timeline, ts_human)
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(txt_content)
            _stage_done("txt", t0)

            # Scorecard
            t0 = _stage_start("scorecard")
            stats = BehaviorStatistics.from_logs(logs)
            sc_content = InterviewScorecard.generate(agg, events, stats)
            with open(scorecard_path, "w", encoding="utf-8") as f:
                f.write(sc_content)
            _stage_done("scorecard", t0)

            # JSON
            t0 = _stage_start("json")
            json_payload = {
                "generated_at": ts_human,
                "aggregation":  agg,
                "events":       [e.to_dict() for e in events],
                "timeline":     timeline.to_dict(),
                "frame_logs":   [l.to_dict() for l in logs],
                "statistics":   stats,
            }
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(json_payload, f, indent=2)
            _stage_done("json", t0)

            # Graphs
            t0 = _stage_start("graphs (6 matplotlib figures)")
            graph_paths = GraphGenerator.generate_all(timeline, agg, events, session_dir)
            _stage_done("graphs (6 matplotlib figures)", t0)

            print(f"\n[REPORT] Session dir -> {session_dir}")
            print(f"[REPORT] TXT       -> {txt_path}")
            print(f"[REPORT] Scorecard -> {scorecard_path}")
            print(f"[REPORT] JSON      -> {json_path}")
            if graph_paths:
                for gp in graph_paths:
                    print(f"[GRAPH]  {gp}")
            try:
                print("\n" + sc_content)
            except UnicodeEncodeError:
                print("[REPORT] Scorecard generated successfully (console output skipped due to console encoding)")
            

            total_ms = round((_time.monotonic() - save_t0) * 1000, 1)
            print(f"[BEHAVIOR_ENGINE_REPORT_STAGE] save() complete ({total_ms}ms)")
            return session_dir
        except Exception:
            import traceback
            elapsed_ms = round((_time.monotonic() - save_t0) * 1000, 1)
            print(f"[BEHAVIOR_ENGINE_REPORT_STAGE_ERROR] save() failed after {elapsed_ms}ms")
            traceback.print_exc()
            raise