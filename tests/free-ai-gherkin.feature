Feature: Gherkin writer on /free-ai/gherkin
  /free-ai/gherkin runs Yumon fine-tuned on procedural Gherkin (yumon-pet
  checkpoints/yumon-gherkin-proc-1024-extended, int4, Vercel Blob yumon/gherkin-proc-1024-extended-int4/) in the
  visitor's browser. It is not a chat: the opening goes in as [BOS] text and Yumon continues it.
  Usage goes to /api/events as gherkin_* events with counts and timings, never text.

  Background:
    Given the production build is running at BASE_URL

  Scenario: The page downloads nothing until Yumon is woken, and /free-ai links to it
    When I open /free-ai at 1440x900
    Then there is a link to /free-ai/gherkin
    When I follow it
    Then the opening editor, the examples and the model panel are shown
    And the model panel says ASLEEP
    And no Gherkin model file has been requested

  Scenario: A greedy continuation matches Hyperfield's int4 output for the same opening
    Given hyperfield's yumon-gherkin-webgpu comparison has been recorded
    When I open /free-ai/gherkin at 1440x900
    And I pick the "Vehicles API" example and set temperature to 0
    And I press continue
    Then Yumon wakes and writes a continuation within 90 seconds
    And the continuation as written starts with Hyperfield's int4 greedy text for that opening
    And the display shows the Gherkin keywords capitalized
    And the events include one gherkin_load and one gherkin_write with source example
    And no event carries the text of the opening

  Scenario: A typed opening, STOP, and USE AS OPENING
    Given Yumon is awake on /free-ai/gherkin
    When I type my own opening and set max new tokens to 255
    And I press continue and then STOP while Yumon is writing
    Then the meta line says stopped
    And a gherkin_write with source input and end stopped is sent
    When I press USE AS OPENING
    Then the editor holds the opening plus Yumon's text

  Scenario: Compile Yumon's feature to an app, preview it, edit it and compile again
    Given Yumon has written a greedy continuation of the "Sign in" example
    When I press COMPILE TO TYPESCRIPT
    Then the preview tab shows the app in an iframe sandboxed to scripts only
    And the app inside it has a scenario picker and a sign in page
    And the APP.TS tab shows the orchestration calling mountApp and startApp
    And the APP.SPEC.TS tab shows a Playwright Test file with a SignInSteps class
    And the report counts the steps, how many matched a template and the library functions copied in
    When I add a known step and a step no template knows, and press COMPILE
    Then the tests call steps.pending() for the unknown step and the notes name it
    And two gherkin_compile events are sent, the second with edited true, neither with any Gherkin text

  Scenario: Narrow screens stack the editor above the model panel
    When I open /free-ai/gherkin at 390x844
    Then the editor comes before the model panel
    And the page does not scroll sideways
