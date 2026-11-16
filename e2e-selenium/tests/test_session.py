"""Access control and sessions: protected pages, refresh, and sign-out."""
import pytest

from pages.app_pages import DashboardPage
from pages.login_page import LoginPage


@pytest.mark.smoke
@pytest.mark.parametrize("protected_path", ["/dashboard", "/setup", "/report", "/resume", "/coding"])
def test_protected_pages_redirect_to_login(driver, base_url, protected_path):
    driver.get(base_url + protected_path)
    page = LoginPage(driver, base_url).wait_for_path("/login")
    assert page.is_loaded()


def test_session_survives_page_refresh(logged_in):
    logged_in.driver.refresh()
    logged_in.wait_for_path("/dashboard")
    assert logged_in.greeting_name() == "Rahul"


def test_logged_in_user_skips_login_page(logged_in, base_url):
    logged_in.driver.get(base_url + "/login")
    logged_in.wait_for_path("/dashboard")


def test_sign_out_ends_session(logged_in, base_url):
    logged_in.sign_out()
    logged_in.wait_for_path("/login")
    # The old session must be gone: protected pages send you back to login.
    logged_in.driver.get(base_url + "/dashboard")
    LoginPage(logged_in.driver, base_url).wait_for_path("/login")
