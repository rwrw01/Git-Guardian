# Quality Gates (2025)

## Test requirements (before ANY PR/merge)

| Type | Target | When |
|------|--------|------|
| Unit tests | 80% line coverage on Service + Data layers | Every commit |
| Integration tests | Every API endpoint: 1 happy + 1 error path | Every PR |
| E2E tests | All critical user journeys (login, CRUD, export) | Before merge to main |
| Security scan | DAST baseline scan, 0 HIGH findings | Before release |
| Accessibility | WCAG 2.2 AA, 0 errors | Every PR with UI changes |
| Visual regression | Screenshot diff on critical pages | Every PR with UI changes |

## Test conventions

- Test files: `{module}.test.ts` colocated with source file. No separate `__tests__/` directory.
- Naming: `describe("ModuleName")` > `it("should {expected behavior} when {condition}")`.
- No test interdependency. Each test: own setup and teardown.
- Mock external services at Integration layer boundary. Never mock within Service layer.
- TDD preferred: write failing test first, then implement (superpowers philosophy).
- E2E tests use browser automation (Playwright or equivalent). Test actual user flows, not just HTTP status codes.

## Code review checklist (automated)

Before reporting a feature as complete, verify ALL:
- [ ] No `any` types in changed files
- [ ] New functions have JSDoc with `@param` and `@returns`
- [ ] New API endpoints: OpenAPI spec updated
- [ ] Zod schema for all new external inputs
- [ ] Error messages: Dutch (user-facing), English (logs)
- [ ] No TODO/FIXME without linked issue number
- [ ] File <300 lines, function <40 lines
- [ ] Import order follows convention
- [ ] No secrets/tokens/credentials in code
- [ ] Evidence of working: test output or screenshot, not "it should work"

## Performance baselines

- API: p95 <200ms reads, p95 <500ms writes
- Frontend bundle: initial JS <200KB gzipped
- Lighthouse: Performance >90, Accessibility >95, Best Practices >95
- DB queries: no N+1. `EXPLAIN` on new queries with joins.
- Docker image: <150MB for interpreted runtimes, <100MB for compiled
- Container startup: <5s to healthy
- Haven Compliancy Checker: pass all checks before deployment
