Feature: World map on the /insights dashboard
  The Map tab shades countries by visitors and drops a dot per city, on Natural Earth 1:110m
  outlines pre-projected to SVG (lib/analytics/world-map.ts, from scripts/build-world-map.mjs).
  No map library, tile server or API key: the SVG is rendered on the server. Countries come
  from x-vercel-ip-country (ISO alpha-2), city dots from x-vercel-ip-latitude/longitude.
  These scenarios render components/insights/WorldMap.tsx on its own; no server is needed.

  Scenario: The country codes Vercel sends find their shapes
    Given the generated world map
    Then every shape has a distinct ISO alpha-2 code, apart from shapes that share a country
    And the codes "US GB DE FR IN BR CN JP CA AU RU NG ZA MX ID XK SO" each have a shape

  Scenario: City dots land inside their own country
    Given the map rendered with these cities
      | city          | country | lat    | lon     |
      | San Francisco | US      | 37.77  | -122.42 |
      | London        | GB      | 51.51  | -0.13   |
      | Tokyo         | JP      | 35.68  | 139.69  |
      | Sao Paulo     | BR      | -23.55 | -46.63  |
      | Sydney        | AU      | -33.87 | 151.21  |
      | Lagos         | NG      | 6.52   | 3.38    |
      | Berlin        | DE      | 52.52  | 13.40   |
      | Mumbai        | IN      | 19.08  | 72.88   |
    Then each city's dot centre is inside its country's shape

  Scenario: Countries with visitors are shaded links, the rest are not
    Given the map rendered with visitors in US 40, GB 12, DE 9, IN 5, BR 1 and five cities
    Then those 5 countries are links that filter to "country:<code>", and no other shape is
    And the US is the most strongly shaded and BR the least
    And there are 5 city dots, each a link that filters to "city:<name>"
    And the legend reads 40 visitors at the top of the scale

  Scenario: Hovering names the place
    Given the map rendered with visitors in US 40, GB 12, DE 9, IN 5, BR 1 and five cities
    When I point at the US and then at the London dot
    Then the status line reads "United States of America: 40 visitors" and then "London, GB: 7 visitors"
    And a screenshot of the map is saved

  Scenario: No data still draws the map
    Given the map rendered with no visitors and no cities
    Then all shapes are drawn unshaded, none are links, and there are no dots
