"""Shared helpers every page object inherits.

Page Object Model (POM): each screen of the app gets one class that knows
*how* to find and use its elements. Tests then read like plain steps
("log in", "open the report page") and only one place changes when the UI does.
"""
from urllib.parse import urlparse

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

DEFAULT_TIMEOUT = 15


class BasePage:
    path = "/"

    def __init__(self, driver, base_url):
        self.driver = driver
        self.base_url = base_url.rstrip("/")
        self.wait = WebDriverWait(driver, DEFAULT_TIMEOUT)

    # --- navigation -------------------------------------------------------
    def open(self):
        self.driver.get(self.base_url + self.path)
        return self

    @property
    def current_path(self):
        return urlparse(self.driver.current_url).path or "/"

    def wait_for_path(self, path):
        self.wait.until(lambda d: self.current_path == path)
        return self

    # --- element helpers -------------------------------------------------
    def find(self, locator):
        return self.wait.until(EC.visibility_of_element_located(locator))

    def click(self, locator):
        self.wait.until(EC.element_to_be_clickable(locator)).click()

    def type(self, locator, text):
        field = self.find(locator)
        field.clear()
        field.send_keys(text)

    def is_visible(self, locator, timeout=2):
        try:
            WebDriverWait(self.driver, timeout).until(EC.visibility_of_element_located(locator))
            return True
        except Exception:
            return False

    def wait_for_text(self, text):
        self.wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "body"), text))

    def page_text(self):
        return self.driver.find_element(By.TAG_NAME, "body").text

    @staticmethod
    def by_text(tag, text):
        """Locator for an element of `tag` whose visible text contains `text`."""
        return (By.XPATH, f"//{tag}[contains(normalize-space(.), {text!r})]")
