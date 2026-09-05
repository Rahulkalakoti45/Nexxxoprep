"""
AI Interview Behavior Analyzer — Phase 4 (headless, Phase 3C)
Entry point only. All engine logic lives in engine.py and the
modules it composes (camera, detector, scoring, tracker, reports,
ui, lifecycle, stream_server). The backend is the only controller:
launching this process starts analysis immediately; sending it
SIGTERM stops it gracefully (report generated on the way out). No
window, no keyboard controls.
"""

import os

from engine import BehaviorEngine


def main():
    stream_port = os.environ.get("BEHAVIOR_ENGINE_STREAM_PORT")
    engine = BehaviorEngine(stream_port=int(stream_port) if stream_port else None)
    engine.run()


if __name__ == "__main__":
    main()

