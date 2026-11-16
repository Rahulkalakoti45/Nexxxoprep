from selenium.webdriver.common.by import By

from .base_page import BasePage


class LoginPage(BasePage):
    path = "/login"

    HEADING = (By.XPATH, "//h2[normalize-space()='Start practising']")
    NAME = (By.CSS_SELECTOR, "input[autocomplete='name']")
    EMAIL = (By.CSS_SELECTOR, "input[type='email']")
    SUBMIT = (By.CSS_SELECTOR, "form button[type='submit']")
    ERROR = (By.CSS_SELECTOR, "[role='alert']")
    MORE_ABOUT_YOU = (By.CSS_SELECTOR, "button[aria-expanded]")
    COLLEGE = (By.CSS_SELECTOR, "input[placeholder='Your college']")
    BRANCH = (By.CSS_SELECTOR, "input[placeholder^='CSE']")
    CHECK_SERVER = (By.XPATH, "//button[contains(., 'Check server') or contains(., 'Server')]")

    def is_loaded(self):
        return self.is_visible(self.HEADING, timeout=10)

    def choose_role(self, role):
        self.click((By.XPATH, f"//div[@role='radiogroup']//button[@role='radio' and normalize-space()={role!r}]"))

    def selected_role(self):
        return self.find((By.CSS_SELECTOR, "div[role='radiogroup'] button[aria-checked='true']")).text.strip()

    def login(self, name, email, role=None):
        self.type(self.NAME, name)
        self.type(self.EMAIL, email)
        if role:
            self.choose_role(role)
        self.click(self.SUBMIT)

    def email_is_valid(self):
        """The browser's own form validation (HTML5 `type=email`, `required`)."""
        return self.driver.execute_script("return arguments[0].checkValidity()", self.find(self.EMAIL))

    def error_message(self):
        return self.find(self.ERROR).text

    def expand_more_about_you(self):
        self.click(self.MORE_ABOUT_YOU)

    def check_server(self):
        self.click(self.CHECK_SERVER)
