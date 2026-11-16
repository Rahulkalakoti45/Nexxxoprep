"""A tiny stand-in for the NexoPrep API server, used only by the Selenium tests.

Real UI tests should not depend on Postgres, Redis or paid AI APIs being up,
so this stub answers the endpoints the UI calls with small, predictable data.
It also records every request so tests can check what the UI actually sent.
"""
import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Emails that make the stub return an error, so tests can check error handling.
REJECTED_EMAIL = "blocked@example.com"


class MockState:
    def __init__(self):
        self.requests = []          # list of (method, path, json_body)
        self.healthy = True         # flip to False to simulate a server outage
        self.lock = threading.Lock()

    def record(self, method, path, body):
        with self.lock:
            self.requests.append((method, path, body))

    def last_body(self, method, path):
        with self.lock:
            for m, p, b in reversed(self.requests):
                if m == method and p == path:
                    return b
        return None

    def reset(self):
        with self.lock:
            self.requests.clear()
            self.healthy = True


STATE = MockState()


def _user_from(payload):
    return {
        "id": "user-" + re.sub(r"[^a-z0-9]", "", payload.get("email", "x").lower())[:20],
        "name": payload.get("name"),
        "email": payload.get("email"),
        "college": payload.get("college"),
        "branch": payload.get("branch"),
        "graduationYear": payload.get("graduationYear"),
        "targetRole": payload.get("targetRole"),
        "experienceLevel": payload.get("experienceLevel"),
    }


# GET routes -> response body. Order matters: first match wins.
GET_ROUTES = [
    (r"^/health$", {"status": "ok"}),
    (r"^/ready$", {"status": "ready"}),
    (r"^/api/analytics/users/[^/]+$", {"snapshot": None}),
    (r"^/api/reports/users/[^/]+/progress$", {"progress": None}),
    (r"^/api/reports/users/[^/]+$", {"reports": []}),
    (r"^/api/resume/users/[^/]+/latest$", {"analysis": None}),
    (r"^/api/users/[^/]+/history$", {"sessions": []}),
    (r"^/api/coding/users/[^/]+/attempts$", {"attempts": []}),
]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # keep test output clean
        pass

    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):  # CORS preflight from the browser
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept, x-api-key, x-correlation-id")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        STATE.record("GET", path, None)
        if not STATE.healthy:
            return self._send(503, {"error": {"message": "Service unavailable"}})
        for pattern, body in GET_ROUTES:
            if re.match(pattern, path):
                return self._send(200, body)
        return self._send(404, {"error": {"message": "Not found"}})

    def do_POST(self):
        path = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        STATE.record("POST", path, body)
        if not STATE.healthy:
            return self._send(503, {"error": {"message": "Service unavailable"}})
        if path == "/api/users":
            if body.get("email") == REJECTED_EMAIL:
                return self._send(400, {"error": {"code": "VALIDATION_ERROR", "message": "This email is not allowed."}})
            return self._send(200, {"user": _user_from(body)})
        return self._send(404, {"error": {"message": "Not found"}})


def start(port=4000):
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


if __name__ == "__main__":
    print("Mock NexoPrep API on http://localhost:4000 (Ctrl+C to stop)")
    start().serve_forever()
