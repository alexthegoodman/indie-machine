Feature: Courses
  /courses lists free interactive courses. The N-Grammer Course is six
  lessons, each a deck of slides with interactive visualizations and quiz
  questions. Every slide is in the server HTML for search engines; the page
  shows one at a time. Progress lives in localStorage.

  Background:
    Given the production build is running at BASE_URL

  Scenario: The courses index links the N-Grammer course
    When I open /courses
    Then I see a card for "The N-Grammer Course"
    And the main navigation has a Courses link

  Scenario: The course page lists six lessons with Course structured data
    When I open /courses/n-grammer
    Then I see 6 lesson cards
    And the page has Course JSON-LD that is free and has 6 parts

  Scenario: Every slide is in the HTML, one is shown
    When I fetch the first lesson's HTML without JavaScript
    Then it contains every slide title and quiz question
    When I open the first lesson in the browser
    Then exactly one slide is visible

  Scenario: Slides move with the buttons and the arrow keys
    When I open the first lesson
    And I click Next
    Then slide 2 is visible and the hash names it
    When I press the left arrow
    Then slide 1 is visible

  Scenario: Answering a quiz gives feedback and is remembered
    When I open the first lesson at its first quiz
    And I choose the correct answer
    Then the quiz shows "CORRECT" and the explanation
    When I reload the page
    Then the quiz is still answered correctly

  Scenario: Reaching the last slide finishes the lesson
    When I open the first lesson at its last slide
    Then the finale links to lesson 2
    When I open the course page
    Then it shows 1 of 6 lessons done

  Scenario: The live layer runs Hyperfield in the page
    When I open the coding lesson at the live slide
    Then the live table has a row per word, computed on the cpu backend
    And the repeated "the cat" reads rows it already read

  Scenario: The live layer at zero projection is a no-op
    When I open the training lesson at the zero-init slide
    Then every |y - x| is 0
    When I raise the projection scale
    Then |y - x| is above 0

  Scenario: The centroid demo trains and leaves a dead centroid
    When I open the training lesson at the training slide
    And I take 15 steps
    Then the centroid loss has gone down
    And centroid 3 still has 0 points

  Scenario: Visualizations react to input
    When I move the bigram row finder to head 1, prev 2, id 3 with K 4
    Then it shows row 31
    When I use the Yumon cp1 preset on the table size calculator
    Then it shows 16,842,752 parameters

  Scenario: Narrow screens do not scroll sideways
    When I open each lesson at 390px wide
    Then the page doesn't scroll sideways
