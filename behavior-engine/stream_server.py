"""
Local MJPEG streaming for the headless Behavior Engine.

This replaces cv2.imshow() as the way a human ever sees the processed
frame. It does not touch detection/scoring/tracking in any way — it only
takes the already-fully-processed BGR frame (with draw_overlay's panel
already drawn on it, exactly as it always was) and serves it as JPEG over
a tiny local-only HTTP server.

Design choices (per Phase 3C: "avoid unnecessary complexity", "the stream
should remain local"):
  - stdlib only (http.server + threading) — no new dependency.
  - binds to 127.0.0.1 only — never reachable off the machine.
  - "latest frame wins": the server always serves whatever frame is most
    recent, never a queue. A slow/absent client cannot back up the
    analyzer loop, and a fast client just sees a live feed.
  - Plain MJPEG-over-HTTP (multipart/x-mixed-replace) so the browser (or
    an <img> tag, via the Node proxy) can render it with zero client-side
    protocol code — this is what keeps the React side trivial.
"""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional

BOUNDARY = "nexoprep-behavior-frame"


class FrameBroadcaster:
    """Thread-safe holder for the single most recent JPEG-encoded frame."""

    def __init__(self):
        self._lock = threading.Lock()
        self._jpeg: Optional[bytes] = None
        self._frame_ready = threading.Event()

    def publish(self, jpeg_bytes: bytes):
        with self._lock:
            self._jpeg = jpeg_bytes
        self._frame_ready.set()

    def latest(self) -> Optional[bytes]:
        with self._lock:
            return self._jpeg


class MetricsBroadcaster:
    """Thread-safe holder for the latest live metrics snapshot.

    Values here are read-only presentations of numbers/labels the
    existing engine already computes each frame (see engine.py's
    _process_frame) — this class does no scoring of its own.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._metrics: Optional[dict] = None

    def publish(self, metrics: dict):
        with self._lock:
            self._metrics = metrics

    def latest(self) -> Optional[dict]:
        with self._lock:
            return dict(self._metrics) if self._metrics is not None else None


def _make_handler(broadcaster: FrameBroadcaster, metrics: MetricsBroadcaster):
    class MjpegHandler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            pass  # silence default per-request stderr logging

        def do_GET(self):
            path = self.path.rstrip("/")
            if path == "/metrics.json":
                self._serve_metrics()
                return
            if path not in ("/stream.mjpg", ""):
                self.send_response(404)
                self.end_headers()
                return
            self._serve_stream()

        def _serve_metrics(self):
            latest = metrics.latest()
            if latest is None:
                self.send_response(503)
                self.end_headers()
                return
            body = json.dumps(latest).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass

        def _serve_stream(self):
            self.send_response(200)
            self.send_header(
                "Content-Type", f"multipart/x-mixed-replace; boundary={BOUNDARY}"
            )
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.end_headers()

            try:
                last_sent = None
                while True:
                    frame = broadcaster.latest()
                    if frame is None or frame is last_sent:
                        time.sleep(0.03)
                        continue
                    last_sent = frame
                    self.wfile.write(f"--{BOUNDARY}\r\n".encode())
                    self.wfile.write(b"Content-Type: image/jpeg\r\n")
                    self.wfile.write(f"Content-Length: {len(frame)}\r\n\r\n".encode())
                    self.wfile.write(frame)
                    self.wfile.write(b"\r\n")
            except (BrokenPipeError, ConnectionResetError, OSError):
                # Client (the Node proxy) disconnected — normal, not an error.
                return

    return MjpegHandler


class StreamServer:
    """Owns the HTTP server lifecycle. start()/stop() are idempotent."""

    def __init__(self, port: int, host: str = "127.0.0.1"):
        self.port = port
        self.host = host
        self.broadcaster = FrameBroadcaster()
        self.metrics = MetricsBroadcaster()
        self._httpd: Optional[ThreadingHTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    def start(self):
        if self._httpd is not None:
            return
        handler = _make_handler(self.broadcaster, self.metrics)
        self._httpd = ThreadingHTTPServer((self.host, self.port), handler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        print(f"[BEHAVIOR_ENGINE_STREAM_STARTED] http://{self.host}:{self.port}/stream.mjpg")

    def publish_frame(self, bgr_frame, jpeg_quality: int = 70):
        import cv2  # local import: keeps this module importable even if cv2

        ok, buf = cv2.imencode(
            ".jpg", bgr_frame, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality]
        )
        if ok:
            self.broadcaster.publish(buf.tobytes())

    def publish_metrics(self, metrics: dict):
        self.metrics.publish(metrics)

    def stop(self):
        if self._httpd is None:
            return
        print("[BEHAVIOR_ENGINE_STREAM_STOPPED]")
        self._httpd.shutdown()
        self._httpd.server_close()
        self._httpd = None
        self._thread = None
