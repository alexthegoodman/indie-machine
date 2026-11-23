Feature: The reader survey that opens every post
  Every post stops after its intro paragraph with the survey questions in lib/survey.ts (now just
  one: how did you find us; "what are you working on" is commented out). The page only sends the intro; a server action stores the answers and
  returns the rest of the post, and on later posts returns it straight away for a visitor on
  record. Answers land in survey_responses and show in the Survey view of /insights. Questions
  and mode live in lib/survey.ts (required | optional | off).

  Background:
    Given the production build is running at BASE_URL with ANALYTICS_PASSWORD set
    And no test survey responses are stored yet

  Scenario: A new reader sees the intro and the survey, not the rest
    Given a browser that has never answered the survey
    When I open a dev post
    Then the intro paragraph is visible
    And the article has no h2, and there is no chapter list
    And the survey shows "How did you find Indie Machine?" (and not the work question) with "CONTINUE READING" disabled
    And the page's HTML holds the intro but none of the rest of the post
    And a survey_view event is stored, and no read_depth event

  Scenario: Answering opens the post and stores the answers
    Given a browser that has never answered the survey
    When I open a dev post, pick "Somewhere else", and type where
    And I press "CONTINUE READING"
    Then the survey is gone and the rest of the article, with its h2s and chapters, is in place
    And one survey response is stored with found "other", the note, no work answer and the session's source
    And a survey_submit event is stored with the same choice and no note text
    And scrolling to the end now records read_depth 100

  Scenario: Answered once, every post is open
    Given a browser that answered the survey
    When I load a review and a game announcement directly
    Then neither shows the survey, and the rest of each post arrives on its own
    When I click through to another post from the up next list
    Then that post shows no survey either

  Scenario: The server decides, not the browser
    Given a browser that claims to have answered but has no stored response
    When I open a dev post
    Then the survey shows, and the rest of the post is not sent

  Scenario: Phones get the same gate
    Given a 390 x 844 browser that has never answered the survey
    When I open a review
    Then the survey fits the screen width with no horizontal scroll

  Scenario: Answering again replaces the earlier answers
    Given a browser that answered "Somewhere else" with a note
    When it forgets that it answered, reloads, and answers "Hacker News"
    Then the visitor has exactly one stored response, holding the second answer
    And "found" free text is dropped unless found is "other"

  Scenario: The Survey view shows what readers said
    Given 12 seeded responses: 6 found via Reddit, 4 via search, 2 "Somewhere else" with notes
    When I sign in to /insights and open the Survey view
    Then the Responses tile counts at least 12
    And the question table lists every choice, and there is no "Working on" column
    And "In their own words" shows both notes
    And the CSV export with kind=survey has a row for each seeded response
