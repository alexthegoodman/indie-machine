Feature: Media-center app shell
  Indie Machine reads like a media app: a persistent top bar and sidebar,
  card feeds with filters, a reader page with chapters and an up-next queue,
  and per-browser library state (saved posts, history, progress).

  Background:
    Given the production build is running at BASE_URL

  Scenario: Home renders the shell, featured carousel and feed
    When I open "/"
    Then I see the top bar with the search button
    And the sidebar links to every existing section route
    And the featured carousel can move to the next slide
    And the feed shows post cards

  Scenario: A Free AI banner tops the home page and opens /free-ai
    When I open / at 1440x900
    Then a gold "Free AI" banner sits above the featured carousel
    And Yumon's mascot appears on the left of the banner after the page has loaded, with no look toggle
    When I click the banner
    Then I am on /free-ai
    And on a 390px wide viewport the banner fits without sideways scroll
    And the phone never downloads the mascot model

  Scenario: Feed chips filter the home feed
    When I open "/"
    And I pick the "Game drops" chip
    Then every card in the feed is a game announcement

  Scenario: Search palette opens with the keyboard and navigates
    When I open "/"
    And I press Control+K
    And I type "kiri"
    And I press Enter
    Then I am on a "/posts/" URL whose title mentions Kiri

  Scenario: Reader shows chapters, progress and save
    When I open a scored product review
    Then the chapters list in the article column shows the article's sections
    When I scroll halfway through the article
    Then the reading progress bar moves past 0
    When I press SAVE
    Then a "Saved to your library" toast appears
    And "/library" lists the post under Saved for later

  Scenario: Continue-reading dock follows the reader around
    Given I read part of a post
    When I open "/"
    Then the continue-reading dock shows that post
    And the "Continue reading" shelf shows it with a progress bar
    When I dismiss the dock
    Then the dock is hidden

  Scenario: Auto-advance counts down at the end of a post and can be cancelled
    When I open a post and scroll to the end card
    Then the end card counts down to the next post
    When I press CANCEL
    Then the countdown stops

  Scenario: Sidebar collapses and the choice persists
    When I open "/" on a desktop viewport
    And I press the navigation toggle
    Then the sidebar is in compact mode after a reload

  Scenario: Phone layout uses a drawer and never scrolls sideways
    Given a 390px wide viewport
    When I open "/" and a post page
    Then the page is no wider than the viewport
    When I press the navigation toggle
    Then the navigation drawer opens

  Scenario: Every index route renders its channel page without errors
    When I open each of "/products", "/dev", "/announcements", "/series", "/series/Entropy", "/archive", "/library", "/games", "/free-ai", "/promote", "/about"
    Then each responds 200 with an h1 and no console errors
