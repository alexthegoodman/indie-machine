Feature: Chat with Yumon on post pages
  Post pages put a chat with Yumon (the Hyperfield port of the yumon-pet decoder, int4,
  running in the reader's browser) between the site navigation and the article: 40% chat,
  60% article on wide screens, a collapsed bar above the article on narrow ones. Chapters
  and Up next sit in the article column; there is no right-hand sidebar. Usage goes to
  /api/events as yumon_* events with counts and timings, never message text.

  Background:
    Given the production build is running at BASE_URL

  Scenario: Wide screens show the chat left of the article and no right sidebar
    When I open a post at 1440x900
    Then the chat column sits left of the article at about 40% of their width
    And nothing is rendered to the right of the article
    And the chapters and the up next list are inside the article column
    And no model file has been requested

  Scenario: Waking Yumon and chatting records usage without message text
    When I open a post at 1440x900
    And I press WAKE YUMON
    Then Yumon is awake within 90 seconds
    When I pick the "Hi Yumon!" suggestion
    Then Yumon replies
    When I type "what is your favorite food?" and press SEND
    Then Yumon replies again
    And the events include a successful yumon_load and two yumon_message events
    And no event carries the text I typed

  Scenario: The model and conversation survive moving to the next post
    Given Yumon is awake and has replied once on a post
    When I open the first Up next post
    Then the chat still shows the earlier conversation
    And Yumon is still awake without a second yumon_load

  Scenario: A browser that woke Yumon before loads it without a click
    Given Yumon was woken in this browser on an earlier visit
    When I open a post at 1440x900
    Then Yumon wakes on its own and yumon_load says auto

  Scenario: Narrow screens collapse the chat above the article
    When I open a post at 390x844
    Then the chat is a single bar above the article
    When I press OPEN
    Then the chat input is visible and a yumon_open event is sent
