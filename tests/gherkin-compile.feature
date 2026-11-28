Feature: Gherkin to TypeScript compiler (lib/gherkin-ts)
  /free-ai/gherkin compiles Yumon's feature files to Playwright Test TypeScript in the browser.
  Yumon learned Gherkin from yumon-pet's procedural generator, whose 316 step templates are copied
  into lib/gherkin-ts/templates.ts by scripts/build-gherkin-templates.mjs. Each step line is matched
  against them (case-insensitive) and becomes a call on a per-feature steps class; templates with a
  Playwright body in lib/gherkin-ts/bodies.ts get real code, the rest a stub that marks the test fixme.
  Run under Node: node tests/gherkin-compile.test.mjs

  Scenario: Every step template compiles to a unique method
    Given the 316 step templates
    Then each has a camelCase method name and no two share one
    And every Playwright body belongs to a known template

  Scenario: Lowercase lines match their templates with typed arguments
    When I match lines as Yumon writes them (lowercase, singular forms, curly quotes, a final period)
    Then each picks the most specific template and its arguments, numbers as numbers
    And a line no template knows matches nothing

  Scenario: The training corpus compiles with every step matched
    Given yumon-pet training-cache/gherkin-proc-1024/units.jsonl (12,000 features)
    When I compile each feature lowercased
    Then every step matches a template
    And the share of steps with a Playwright body is printed

  Scenario: Compiled features type-check against @playwright/test
    Given 300 compiled features spread over the corpus, and one file with two features and an unmatched line
    When I run tsc --strict on them with @playwright/test's types
    Then there are no errors

  Scenario: Repeated scenario titles get numbered and Background becomes beforeEach
    When I compile a feature with a Background and two scenarios with the same title
    Then the Background steps run in test.beforeEach
    And the second test title ends in "(2)", since Playwright refuses duplicate titles
