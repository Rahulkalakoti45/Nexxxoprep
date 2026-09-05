"""
Webcam capture wrapper.

Isolates the OpenCV VideoCapture setup (device index, resolution,
target FPS, frame-flip) from the rest of the engine. Behavior and
capture settings are identical to the original main.py — only the
call site moved.
"""

import cv2


class Camera:
    def __init__(self, device_index: int = 0,
                 width: int = 1280, height: int = 720, fps: int = 30):
        self.cap = cv2.VideoCapture(device_index)
        if not self.cap.isOpened():
            raise RuntimeError("Cannot open webcam.")

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH,  width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS,          fps)

    def read(self):
        """Returns a flipped BGR frame, or None if the read failed."""
        ret, frame = self.cap.read()
        if not ret:
            return None
        return cv2.flip(frame, 1)

    def release(self):
        self.cap.release()
