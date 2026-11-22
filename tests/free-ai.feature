Feature: Free AI page with saved Yumon threads
  /free-ai runs Yumon (the Hyperfield port of the yumon-pet decoder, int4) in the visitor's
  browser, laid out like an agent manager: a thread list, the open thread, and an agent panel
  with this thread's settings and stats. Threads, titles and settings are kept in
  localStorage (im-yumon-threads-v1). Usage goes to /api/events as yumon_* events with counts
  and timings, never message or title text.

  Background:
    Given the production build is running at BASE_URL

  Scenario: The page shows the thread manager and downloads nothing until Yumon is woken
    When I open /free-ai at 1440x900
    Then the thread list, the open thread and the agent panel sit side by side
    And there is one empty thread called "New thread"
    And there is no Yumon Portal download link
    And no model file has been requested

  Scenario: Chatting names the thread and records usage without text
    When I open /free-ai at 1440x900
    And I press WAKE YUMON
    Then Yumon is awake within 90 seconds
    When I pick the "Hi Yumon!" suggestion
    Then Yumon replies
    And the thread is titled "Hi Yumon!"
    When I type "what is your favorite food?" and press Enter
    Then Yumon replies again
    And the agent panel counts 2 replies
    And the events include a yumon_load and two yumon_message events
    And no event carries the text I typed

  Scenario: Threads survive a reload and keep their own settings
    Given Yumon is awake on /free-ai with one finished thread
    When I start a new thread
    And I turn memory off and set temperature to 0 for it
    And I send "tell me a story"
    Then Yumon replies in the new thread
    And the thread list shows 2 threads
    When I reload the page
    Then both threads are still listed with the newer one open
    And the open thread still has memory off and temperature 0
    And the older thread still has memory on

  Scenario: Rename, pin, regenerate, export and delete a thread
    Given Yumon is awake on /free-ai with two finished threads
    When I rename the open thread to "Food talk" and pin it
    Then "Food talk" is first in the thread list with a pin mark
    When I press REGENERATE
    Then the last reply is replaced and a yumon_message with source regenerate is sent
    When I press EXPORT .MD
    Then a Markdown file named food-talk.md downloads with the thread in it
    When I press DELETE and then CONFIRM DELETE
    Then "Food talk" is gone and one thread is left

  Scenario: Stopping a reply keeps what Yumon said so far
    Given Yumon is awake on /free-ai
    When I set max reply tokens to 256 and send "tell me a long story"
    And I press STOP while Yumon is writing
    Then the reply ends and its meta line says stopped

  Scenario: Narrow screens fold the thread list behind a button
    When I open /free-ai at 390x844
    Then the thread list is hidden behind a THREADS button
    When I press THREADS
    Then the thread list is visible
