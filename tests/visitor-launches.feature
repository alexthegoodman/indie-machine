Feature: Visitor Launches bar
  Under the top bar on every page, a one-row strip lists products visitors launched.
  Anyone can paste a product URL, no account. The server reads the page's own name,
  tagline and icon, refuses duplicates, private addresses and shorteners, and the
  listing is live as soon as the request returns.

  Background:
    Given the production build is running at BASE_URL
    And the test products are not launched yet

  Scenario: A visitor launches a product from the bar
    When I open "/"
    And I click "LAUNCH YOURS" in the launches bar
    And I submit "example.com"
    Then within 30 seconds the bar shows "Example Domain" first, marked as just launched
    And the listing links to "https://example.com/" with rel "nofollow ugc"
    And reloading "/dev" still shows "Example Domain" in the bar

  Scenario: The same product can't be launched twice
    Given "example.com" is launched
    When I submit "http://www.example.com/pricing?ref=ph" through the API
    Then the API answers 409 "duplicate"
    And when I submit it through the bar, the form shows "already launched"

  Scenario: Shared hosts key on the path
    When I submit "github.com/vercel/next.js" through the API
    Then the API answers 201
    And submitting "https://github.com/vercel/next.js/" again answers 409

  Scenario: Unsafe and junk URLs are refused before anything is stored
    When I submit each of these through the API
      | url                       | code        |
      | http://127.0.0.1/admin    | invalid     |
      | http://localhost:3000     | invalid     |
      | localtest.me              | invalid     |
      | https://bit.ly/abc        | blocked     |
      | ftp://example.org         | invalid     |
      | no-such-host.invalid      | unreachable |
    Then each answers 400 with that code
    And a POST with a foreign Origin answers 403
    And a POST with the honeypot filled answers 400

  Scenario: The bar can be hidden and stays hidden
    When I open "/"
    And I click "Hide visitor launches"
    Then the bar folds to one line with a SHOW button
    And after reloading the page it is still folded
    And "Show visitor launches" opens it again

  Scenario: The bar fits a phone
    When I open "/" at 390x844
    Then the launches bar has no horizontal page overflow
