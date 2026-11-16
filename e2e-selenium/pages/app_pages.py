"""Page objects for the screens behind login."""
from selenium.webdriver.common.by import By

from .base_page import BasePage


class AppShell(BasePage):
    """The navbar and account menu shared by every logged-in page."""

    NAV = (By.CSS_SELECTOR, "header nav[aria-label='Main']")
    ACCOUNT_MENU = (By.CSS_SELECTOR, "header button[aria-haspopup='menu']")
    SIGN_OUT = (By.XPATH, "//button[@role='menuitem' and contains(., 'Sign out')]")

    def go_to(self, link_text):
        self.click((By.XPATH, f"//header//nav[@aria-label='Main']//a[normalize-space()={link_text!r}]"))

    def sign_out(self):
        self.click(self.ACCOUNT_MENU)
        self.click(self.SIGN_OUT)


class DashboardPage(AppShell):
    path = "/dashboard"
    GREETING_NAME = (By.CSS_SELECTOR, "main h1, header + * h1, h1")

    def greeting_name(self):
        return self.find(self.GREETING_NAME).text.strip()


class SetupPage(AppShell):
    path = "/setup"
    HEADING_TEXT = "How do you want to practise?"


class ReportPage(AppShell):
    path = "/report"
    EMPTY_TEXT = "Pick an interview to review"
    BACK_HOME = (By.XPATH, "//a[contains(., 'Back to home')]")


class NotFoundPage(BasePage):
    path = "/this-page-does-not-exist"
    TITLE_TEXT = "Page Not Found"
    GO_TO_DASHBOARD = (By.XPATH, "//a[contains(., 'Go to Dashboard')]")
