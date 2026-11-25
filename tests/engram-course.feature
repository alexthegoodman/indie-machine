Feature: The Engram Course
  /courses/engram is six lessons on DeepSeek's Engram layer with interactive
  visualizations, quizzes, and a live layer computed with Hyperfield in the
  page. tests/courses-engram-parity.mjs checks that layer against PyTorch.

  Background:
    Given the production build is running at BASE_URL

  Scenario: The courses index lists both courses
    When I open /courses
    Then I see a card for "The N-Grammer Course" and one for "The Engram Course"

  Scenario: The course page lists six lessons with Course structured data
    When I open /courses/engram
    Then I see 6 lesson cards
    And the page has Course JSON-LD that is free and has 6 parts

  Scenario: Every lesson's steps are in the server HTML
    When I fetch each lesson's HTML without JavaScript
    Then it contains every step title and quiz question of that lesson

  Scenario: Tokenizer compression groups normalized tokens
    When I open the compression lesson at its first step
    Then the compression widget shows 13 raw tokens and 4 compressed ids
    When I add the token " APPLE"
    Then it shows 14 raw tokens and still 4 compressed ids

  Scenario: The hash widget shows the mix and the rows of both heads
    When I open the hashing lesson at the collision step
    And I switch to trigrams
    Then the hash detail shows the mix modulo 41 and 43

  Scenario: The gate and conv widgets compute the lesson's numbers
    When I open the gate lesson at the curve step
    Then the gate at width 1,024 and cosine 0.2 is 0.9262
    When I open the conv step
    Then output 12 reads positions 3, 6, 9 and 12

  Scenario: The live layer runs Hyperfield in the page
    When I open the coding lesson at the live step
    Then the live table has a row per word, computed on the cpu backend
    And the repeated "the Cat sat on the" reads 4 bigrams and 3 trigrams it already read

  Scenario: A zero-initialized conv adds nothing
    When I open the training lesson at the recipe step
    Then every |y - value| is 0
    When I raise the conv weight scale
    Then |y - value| is above 0

  Scenario: Answering a quiz gives feedback
    When I open the hashing lesson at the row quiz
    And I choose row 9
    Then the quiz shows "CORRECT" and the explanation

  Scenario: Narrow screens do not scroll sideways
    When I open each lesson at 390px wide
    Then the page doesn't scroll sideways
