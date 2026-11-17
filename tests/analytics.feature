Feature: First-party event logging and the /insights dashboard
  Every page reports what visitors do (page views, engaged time, read depth, clicks, searches)
  to /api/events, stored in analytics_events. /insights, behind ANALYTICS_PASSWORD, turns the
  events into overview numbers, content stats, page flows, funnels, retention, sessions and a
  raw event explorer. Every value links to a narrower view.

  Background:
    Given the production build is running at BASE_URL with ANALYTICS_PASSWORD set
    And no test events are stored yet

  Scenario: Browsing the site records what the visitor did
    Given a browser with test tracking allowed and a known visitor id
    When I open "/dev", move the mouse, and click through to a post
    And I scroll the post to the end and leave the page
    Then within 10 seconds the visitor has a pageview for "/dev" and for the post
    And a link_click from "/dev" to the post, with the region it was clicked in
    And an engage event for "/dev" of at least 1 second
    And read_depth events for the post up to 100
    And every event shares one session, with source "direct" and landing page "/dev"

  Scenario: Web vitals are sent once per metric per page load
    Given a browser with test tracking allowed and a known visitor id
    When I open "/" and click through five pages client-side, interacting on each, then leave
    Then at most 5 web_vital events are stored, none for the same metric twice

  Scenario: Search queries and the dashboard itself
    Given a browser with test tracking allowed and a known visitor id
    When I open the search palette and type "zzzz-no-such-post"
    Then a search event with 0 results is stored
    And opening "/insights" stores no page view

  Scenario: The ingest endpoint refuses bad batches
    When I post batches to /api/events
      | case                | status |
      | valid batch         | 204    |
      | foreign Origin      | 403    |
      | not JSON            | 400    |
      | missing session id  | 400    |
      | 51 events           | 413    |
      | Googlebot UA        | 204    |
    Then only the valid batch's events are stored
    And bad event names, paths and props inside a batch are dropped, the rest kept

  Scenario: The dashboard is behind the password
    When I open "/insights"
    Then I see the sign-in form, not data
    And a wrong password shows "That's not the password."
    And the CSV export answers 401 without signing in
    When I sign in with the right password
    Then I see the Overview with KPI tiles and the time chart

  Scenario: Drawing connections in seeded data
    Given 30 seeded sessions: 10 each from bdd-hn.example, bdd-reddit.example, bdd-direct.example
    And half of them read "/posts/fft-ocean-water", and the HN readers clicked out to github.com
    When I filter the Overview by source "bdd-hn.example"
    Then Visitors shows 10
    When I run the funnel "/" -> the post -> outbound_click for that source
    Then the steps show 10, 5 and 5
    When I list sessions that did "e:outbound_click"
    Then 5 sessions are listed, and one opens to a timeline with the post and the click
    And the Breakdown of source by section, Journeys, Retention and Events views render without errors
