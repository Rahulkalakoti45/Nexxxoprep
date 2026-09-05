"""
LEGACY / MANUAL TESTING UTILITY ONLY.

This script is no longer part of the required candidate-intake workflow.
The Automation Service (app/services/automation) now watches
sample_data/incoming/ and processes candidate JSON files automatically
as soon as the FastAPI app starts -- no manual script execution needed.

Keep this script only if you want to hit the HTTP endpoint directly for
manual/local testing. For normal operation, just drop a candidates JSON
file into sample_data/incoming/ instead.
"""

import json
import uuid
import requests

API_URL = "http://127.0.0.1:8000/api/v1/integrations/yash/shortlists"
API_KEY = ""

with open("sample_data/candidates.json", "r", encoding="utf-8") as f:
    candidates = json.load(f)

success = 0
failed = 0

for i, candidate in enumerate(candidates, start=1):
    headers = {
        "x-api-key": API_KEY,
        "x-request-id": str(uuid.uuid4()),
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            API_URL,
            headers=headers,
            json=candidate,
            timeout=30
        )

        if response.status_code == 200:
            success += 1
            print(f"[{i}/{len(candidates)}] ✓ {candidate['name']} - Sent")
        else:
            failed += 1
            print(f"[{i}/{len(candidates)}] ✗ {candidate['name']} - {response.status_code}")
            print(response.text)

    except Exception as e:
        failed += 1
        print(f"[{i}/{len(candidates)}] ✗ {candidate['name']} - {e}")

print("\n========== SUMMARY ==========")
print(f"Total   : {len(candidates)}")
print(f"Success : {success}")
print(f"Failed  : {failed}")