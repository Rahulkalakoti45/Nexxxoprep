# NexoPrep – Selenium End-to-End UI Tests

Automated browser tests for the NexoPrep frontend, written in **Python** with
**Selenium WebDriver** and **pytest**, using the **Page Object Model (POM)**.

**27 test cases** across login, sessions/access control, and navigation.

## How to run

```bash
# 1. Start the frontend (from the repo root)
npm install
npm run dev                # serves http://localhost:5173

# 2. In a second terminal, run the tests
cd e2e-selenium
pip install -r requirements.txt
pytest                     # all tests
pytest -m smoke            # only the quick smoke tests
HEADLESS=0 pytest          # watch Chrome run the tests
```

You do **not** need the real backend, Postgres or Redis running. The tests start
a small **mock API** (`mock_backend.py`) on port 4000 that returns predictable
data and records every request, so the tests can check what the UI sent.

If a test fails, a screenshot is saved to `screenshots/<test name>.png`.

## Project structure

```
e2e-selenium/
├── conftest.py          # fixtures: mock API, Chrome, clean session, logged-in user
├── mock_backend.py      # fake NexoPrep API (port 4000) used only by tests
├── pytest.ini
├── requirements.txt
├── pages/               # Page Object Model
│   ├── base_page.py     # shared waits/clicks/typing helpers
│   ├── login_page.py    # login screen
│   └── app_pages.py     # navbar, dashboard, setup, report, 404 pages
└── tests/
    ├── test_login.py       # 12 cases
    ├── test_session.py     # 8 cases
    └── test_navigation.py  # 7 cases
```

### Why Page Object Model?

Each screen has one class that knows how to find and use its elements
(locators + actions). Tests then read like plain steps:

```python
login_page.login("Rahul Kalakoti", "rahul@example.com", role="Backend")
dashboard.wait_for_path("/dashboard")
```

If the UI changes (a button's text, a CSS class), you fix one locator in one
page class instead of every test.

### Waits, not sleeps

Every action waits for the element to be visible or clickable
(`WebDriverWait` + `expected_conditions`). There is no `time.sleep()`, so the
tests stay fast and don't break when the page is a little slow.

## What is covered

| Area | Test cases |
|---|---|
| **Login form** | form renders; empty form is not submitted; 3 invalid email formats blocked by the browser; valid login opens dashboard with first name |
| **API contract** | UI trims the name, lower-cases the email, sends the chosen role and default experience level |
| **UI controls** | role selector allows only one choice; optional "More about you" section expands |
| **Error handling** | API error message is shown and the user stays on login; "Check server" shows healthy vs. outage |
| **Access control** | 5 protected pages (`/dashboard`, `/setup`, `/report`, `/resume`, `/coding`) redirect to login when signed out |
| **Sessions** | session survives refresh; logged-in user skips the login page; sign-out ends the session |
| **Navigation** | 4 navbar links open the right page; setup lists all practice modes; report empty state links home; unknown URL shows 404 with a way back |

## Ideas to extend

- Run the suite in **GitHub Actions** on every push.
- Add tests for the resume upload and the coding round.
- Add cross-browser runs (Firefox) and parallel runs with `pytest-xdist`.
