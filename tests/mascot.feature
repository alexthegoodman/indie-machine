Feature: Yumon's robot mascot
  The post chat and /free-ai show Yumon's body above the chat: a Meshy-made, Meshy-rigged
  humanoid robot in two looks (MECH by default, and SOFT), drawn with Three.js as a waist-up
  portrait. Its clip follows the
  chat: asleep before the model is woken, scratching its head until the first token, talking
  while the reply streams, cheering when it wakes and waving when clicked. three.js and the
  3.8 MB model load only once the stage is on screen.

  # These run against the scene module alone, served through page.route (no server).
  Scenario Outline: Each robot renders each clip
    Given the <variant> robot is loaded on a 360x240 stage
    When it rests in the <clip> clip for a second
    Then the stage has robot pixels in the middle and transparent bottom corners

    Examples:
      | variant | clip  |
      | bot     | idle  |
      | bot     | doze  |
      | bot     | think |
      | bot     | talk  |
      | bot     | wave  |
      | bot     | cheer |
      | mech    | idle  |
      | mech    | doze  |
      | mech    | think |
      | mech    | talk  |
      | mech    | wave  |
      | mech    | cheer |

  Scenario: Reduced motion draws one still frame
    Given the bot robot is loaded with reduced motion
    Then the stage has robot pixels in the middle
    And no animation frame is requested afterwards

  # These need the production build at BASE_URL.
  Scenario: The post chat stage sleeps until Yumon wakes and loads nothing off screen
    When I open a post at 1440x900
    Then the mascot stage is in the chat column with clip "doze"
    And the mech model is requested once
    When I open a post at 390x844
    Then no mascot model is requested while the chat is collapsed

  Scenario: Picking SOFT swaps the model and is remembered
    When I open a post at 1440x900
    And I press SOFT on the mascot stage
    Then the bot model is requested and the stage says variant "bot"
    When I reload the page
    Then the stage still says variant "bot"

  Scenario: The mascot follows a reply on /free-ai
    When I open /free-ai at 1440x900 and wake Yumon
    Then the agent panel stage moves to clip "idle"
    When I send "Hi Yumon!"
    Then the stage shows clip "think" or "talk" while Yumon writes
    And it rests in clip "idle" after the reply
