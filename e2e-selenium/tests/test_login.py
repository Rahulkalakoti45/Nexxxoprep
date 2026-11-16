"""Login flow: form validation, the request sent to the API, and error handling."""
import pytest

from pages.app_pages import DashboardPage


@pytest.mark.smoke
def test_login_page_shows_the_form(login_page):
    assert login_page.is_loaded()
    assert login_page.is_visible(login_page.NAME)
    assert login_page.is_visible(login_page.EMAIL)
    assert login_page.is_visible(login_page.SUBMIT)


def test_empty_form_is_not_submitted(login_page, api):
    login_page.click(login_page.SUBMIT)
    assert login_page.current_path == "/login"
    assert api.last_body("POST", "/api/users") is None, "UI must not call the API with an empty form"


@pytest.mark.parametrize("bad_email", ["not-an-email", "rahul@", "@example.com"])
def test_invalid_email_is_blocked(login_page, api, bad_email):
    login_page.login("Rahul", bad_email)
    assert not login_page.email_is_valid()
    assert login_page.current_path == "/login"
    assert api.last_body("POST", "/api/users") is None


@pytest.mark.smoke
def test_valid_login_opens_dashboard_with_first_name(login_page, base_url):
    login_page.login("Rahul Kalakoti", "rahul@example.com")
    dashboard = DashboardPage(login_page.driver, base_url).wait_for_path("/dashboard")
    assert dashboard.greeting_name() == "Rahul"


def test_login_sends_clean_data_to_api(login_page, base_url, api):
    login_page.login("  Rahul Kalakoti  ", "  Rahul@Example.COM ", role="Backend")
    DashboardPage(login_page.driver, base_url).wait_for_path("/dashboard")
    body = api.last_body("POST", "/api/users")
    assert body["name"] == "Rahul Kalakoti", "name should be trimmed"
    assert body["email"] == "rahul@example.com", "email should be trimmed and lower-cased"
    assert body["targetRole"] == "Backend"
    assert body["experienceLevel"] == "Fresher", "default experience level"


def test_role_selector_allows_one_choice(login_page):
    assert login_page.selected_role() == "SDE", "SDE is the default"
    login_page.choose_role("Data Analyst")
    assert login_page.selected_role() == "Data Analyst"


def test_optional_details_section_expands(login_page):
    assert not login_page.is_visible(login_page.COLLEGE, timeout=1)
    login_page.expand_more_about_you()
    assert login_page.is_visible(login_page.COLLEGE)
    assert login_page.is_visible(login_page.BRANCH)


def test_api_error_is_shown_and_user_stays_on_login(login_page, api):
    import mock_backend

    login_page.login("Blocked User", mock_backend.REJECTED_EMAIL)
    assert "This email is not allowed." in login_page.error_message()
    assert login_page.current_path == "/login"


def test_check_server_reports_healthy_api(login_page):
    login_page.check_server()
    login_page.wait_for_text("Server connected")


def test_check_server_reports_outage(login_page, api):
    api.healthy = False
    login_page.check_server()
    login_page.wait_for_text("Server unreachable")
