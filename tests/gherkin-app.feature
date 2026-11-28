Feature: Gherkin to TypeScript apps (lib/gherkin-app)
  /free-ai/gherkin compiles Yumon's feature to a small TypeScript app plus Playwright tests for it.
  lib/gherkin-app/library.ts is the boilerplate (getElementById helpers for pages, fields, lists,
  dialogs, accounts, counters, facts); scripts/build-gherkin-library.mjs splits it per declaration
  into library.gen.ts. plan.ts reads each matched step as a page, element, action or expected result,
  emit.ts writes the orchestration and copies in only the functions it calls (and their dependencies).
  The tests are lib/gherkin-ts compiled in app mode, so they drive that app in Chrome.
  Run under Node (no Next server): node tests/gherkin-app.test.mjs
  Env: PER_KIND (default 2), KINDS, CORPUS, PLAYWRIGHT_MODULES, OUT.

  Scenario: Every sampled feature builds an app and its tests
    Given PER_KIND features of each kind from yumon-pet's training corpus, lowercased
    When I build each one's app and compile its tests in app mode
    Then every feature gives an app.ts, an index.html with a CSP that blocks the network, and an app.spec.ts

  Scenario: The apps and their tests type-check (tsc --strict)
    When I run tsc --strict over every app.ts and app.spec.ts with @playwright/test's types
    Then there are no errors

  Scenario: The compiled tests pass against their apps in Chrome
    Given the apps served from a throwaway static server, one Playwright project per app
    When I run every compiled test, each starting its scenario through window.gherkinApp.load
    Then every test passes and none is fixme
    And failures.txt and summary.json in OUT list any that did not
