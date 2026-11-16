"""Shared pytest fixtures: the mock API, the browser, and a logged-in user.

Run the app first (from the repo root):   npm run dev
Then run the tests (from e2e-selenium/):  pytest

Settings (environment variables):
  BASE_URL   where the frontend runs   (default http://localhost:5173)
  HEADLESS   set to 0 to watch Chrome  (default 1)
  CHROMEDRIVER  path to a chromedriver that matches your Chrome (optional;
                Selenium downloads the right one automatically if unset)
"""
import os

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service

import mock_backend
from pages.app_pages import DashboardPage
from pages.login_page import LoginPage

BASE_URL = os.environ.get("BASE_URL", "http://localhost:5173")


@pytest.fixture(scope="session")
def api():
    """Start the mock NexoPrep API on port 4000 once for the whole run."""
    server = mock_backend.start(port=4000)
    yield mock_backend.STATE
    server.shutdown()


@pytest.fixture(scope="session")
def _browser():
    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS", "1") != "0":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1400,1000")
    options.add_argument("--no-sandbox")
    driver_path = os.environ.get("CHROMEDRIVER")
    service = Service(driver_path) if driver_path else Service()
    driver = webdriver.Chrome(options=options, service=service)
    yield driver
    driver.quit()


@pytest.fixture
def driver(_browser, api, request):
    """A clean browser for every test: no saved session, fresh mock state."""
    api.reset()
    _browser.get(BASE_URL + "/login")
    _browser.delete_all_cookies()
    _browser.execute_script("window.localStorage.clear(); window.sessionStorage.clear();")
    # Leave the app before the test starts, so no running page can write the
    # old session back into storage after we cleared it (that made tests flaky).
    _browser.get("about:blank")
    yield _browser
    # Save a screenshot when a test fails, to make debugging easy.
    if getattr(request.node, "rep_call", None) and request.node.rep_call.failed:
        os.makedirs("screenshots", exist_ok=True)
        _browser.save_screenshot(f"screenshots/{request.node.name}.png")


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)


@pytest.fixture
def base_url():
    return BASE_URL


@pytest.fixture
def login_page(driver, base_url):
    return LoginPage(driver, base_url).open()


@pytest.fixture
def logged_in(driver, base_url):
    """Log in through the real UI and land on the dashboard."""
    page = LoginPage(driver, base_url).open()
    if not page.is_loaded():
        # One retry with a fresh load, in case the dev server was still compiling.
        driver.execute_script("window.localStorage.clear();")
        page.open()
    assert page.is_loaded(), f"login page did not load (now at {page.current_path})"
    page.login("Rahul Kalakoti", "rahul@example.com")
    return DashboardPage(driver, base_url).wait_for_path("/dashboard")
