Feature: Post page experience
  Every post opens on its own procedural intro (a seeded WebGL scene and a
  huge kinetic title), and the article reads as a designed piece: numbered
  display-size section heads, a lede that fills in as it's read, floating
  interludes pulled from the text, a topic marquee and scroll reveals. The
  Yumon chat keeps its 30% column.

  Background:
    Given the production build is running at BASE_URL

  Scenario: Each post gets its own procedural intro
    When I open a dev log, a product review and a game announcement
    Then each intro renders a WebGL scene that has drawn frames
    And the intro's h1 holds the post title in display type of at least 56px
    And the three posts don't share the same program and palette
    And the scene keeps animating while the intro is on screen

  Scenario: The intro scrolls away into the article
    When I open a dev log
    And I scroll one screen down
    Then the intro's title words have drifted apart
    And the scene stops drawing once the intro is off screen

  Scenario: Section heads are large and numbered
    When I open a dev log
    Then every h2 in the article is at least 36px
    And the first h2 is numbered "01 /"
    And the chapters list still uses the plain heading text

  Scenario: Interludes float text pulled from the article
    When I open a dev log with several sections
    Then at least one interlude is in the article and hidden from assistive tech
    When I scroll an interlude through the viewport
    Then its words move by different amounts

  Scenario: The lede fills in as it's read
    When I open a dev log
    And I scroll the lede past the reading line
    Then its read progress goes from below 1 to 1

  Scenario: Reduced motion gets a still, readable page
    Given the browser prefers reduced motion
    When I open a dev log
    Then the scene draws a single frame
    And the title words sit at rest

  Scenario: Chat keeps its 30% column on wide screens
    When I open a dev log at 1440px wide
    Then the chat takes about 30% of the chat + article width

  Scenario: Narrow screens get the intro under the chat bar
    When I open a product review at 390px wide
    Then the page doesn't scroll sideways
