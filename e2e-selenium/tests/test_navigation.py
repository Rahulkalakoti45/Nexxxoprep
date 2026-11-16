"""Navigation between the main screens once logged in."""
import pytest

from pages.app_pages import NotFoundPage, ReportPage, SetupPage


@pytest.mark.parametrize(
    "link_text, expected_path",
    [("Resume", "/resume"), ("Practice", "/setup"), ("Coding", "/coding"), ("Home", "/dashboard")],
)
def test_navbar_links_open_the_right_page(logged_in, link_text, expected_path):
    if link_text == "Home":
        logged_in.go_to("Coding")
        logged_in.wait_for_path("/coding")
    logged_in.go_to(link_text)
    logged_in.wait_for_path(expected_path)


@pytest.mark.smoke
def test_setup_page_lists_all_practice_modes(logged_in, base_url):
    setup = SetupPage(logged_in.driver, base_url).open()
    setup.wait_for_text(setup.HEADING_TEXT)
    text = setup.page_text()
    for mode in ["Voice interview", "Coding round", "Structured rounds"]:
        assert mode in text, f"missing practice mode: {mode}"


def test_report_page_empty_state_links_home(logged_in, base_url):
    report = ReportPage(logged_in.driver, base_url).open()
    report.wait_for_text(report.EMPTY_TEXT)
    report.click(report.BACK_HOME)
    report.wait_for_path("/dashboard")


def test_unknown_url_shows_404_with_way_back(logged_in, base_url):
    page = NotFoundPage(logged_in.driver, base_url).open()
    page.wait_for_text(page.TITLE_TEXT)
    page.click(page.GO_TO_DASHBOARD)
    page.wait_for_path("/dashboard")
