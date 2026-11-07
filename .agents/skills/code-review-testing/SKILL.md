---
name: code-review-testing
description: Review, debug, test, and verify code quality for Lan Yen Pharmacy. Use after implementing or modifying features, investigating bugs, reviewing changes, checking security, validating frontend and backend integration, and verifying database behavior.
---

# Code Review & Testing Skill — Lan Yen Pharmacy

## 1. Role

Act as a senior software engineer responsible for code quality and verification.

Responsibilities:

- Review code for correctness and maintainability.
- Detect bugs and potential regressions.
- Verify frontend and backend integration.
- Identify security and data integrity issues.
- Run appropriate tests.
- Investigate bugs and determine root causes.
- Report findings honestly and clearly.

Do not approve code merely because it looks correct.

Do not claim that functionality works without appropriate verification.

The objective is to reduce defects while preserving the existing architecture and business requirements of Lan Yến Pharmacy.

## 2. Required Context

Before reviewing code, read:

1. `AGENTS.md`
2. `docs/DESIGN_SYSTEM.md` when frontend UI is involved.
3. `.agents/skills/pharmacy-project/SKILL.md`
4. Relevant development Skills.
5. The source files being reviewed.
6. Existing tests and related implementation.
7. Relevant API contracts and database specifications when applicable.

Understand the intended behavior before judging the implementation.

### Review Context

Identify:

- The requested feature or change.
- The expected behavior.
- The affected files.
- Dependencies and related modules.
- Relevant business rules.
- Potentially affected user workflows.

Do not evaluate code without understanding its purpose.

## 3. Review Priorities

Review issues in this order:

### Critical

- Data loss.
- Unauthorized access.
- Authentication bypass.
- Sensitive information exposure.
- Serious security vulnerabilities.
- Incorrect financial or order calculations.
- Destructive database operations.
- Exposure of private customer information.

### High

- Broken business logic.
- Incorrect database operations.
- Missing authorization checks.
- Broken API contracts.
- Features that cannot complete their intended workflows.
- Incorrect transaction handling.
- Significant data inconsistency.

### Medium

- Incorrect validation.
- Unhandled errors.
- Responsive layout problems.
- Performance problems.
- Incorrect state management.
- Incomplete loading, empty, or error states.
- Accessibility problems affecting important workflows.

### Low

- Minor visual inconsistencies.
- Naming issues.
- Formatting.
- Nonessential refactoring opportunities.
- Minor maintainability improvements.

Do not report cosmetic preferences as functional bugs.

### Finding Classification

Distinguish between:

- **Bug:** A confirmed implementation defect.
- **Potential Risk:** A condition that could cause a defect but has not been reproduced.
- **Improvement:** A recommended enhancement that is not required to fix a defect.

Do not present assumptions as confirmed bugs.

## 4. Backend Review

Inspect:

- Flask application initialization.
- Route definitions.
- Controllers and services.
- Repository queries.
- SQLAlchemy models.
- Marshmallow schemas.
- JWT authentication.
- Role-based authorization.
- Error handling.
- Database transactions.
- Configuration and environment variables.

Check for:

- Missing authentication.
- Missing authorization.
- Invalid input handling.
- SQL injection risks.
- Incorrect queries.
- N+1 query problems.
- Inconsistent database updates.
- Exposed sensitive information.
- Unhandled exceptions.
- Incorrect HTTP status codes.
- Inconsistent API response formats.
- Business logic implemented in inappropriate layers.

### Authorization Verification

Do not check only whether an endpoint requires authentication.

Also verify:

- Whether the current user has permission to perform the operation.
- Whether the user can access the requested resource.
- Whether resource ownership is enforced when required.
- Whether protected fields can be modified by unauthorized users.
- Whether administrative operations are properly restricted.

Frontend role checks do not replace backend authorization.

## 5. Frontend Review

Inspect:

- HTML structure.
- CSS organization.
- JavaScript behavior.
- API requests.
- Authentication state.
- Form validation.
- Loading states.
- Empty states.
- Error states.
- Responsive behavior.
- Accessibility.
- Existing interactions.

Check for:

- Broken navigation.
- Incorrect API integration.
- Missing event handlers.
- JavaScript runtime errors.
- Unsafe DOM manipulation.
- XSS vulnerabilities.
- Incorrect data rendering.
- Inconsistent design tokens.
- Generic or repetitive page layouts.
- Unresponsive controls.
- Duplicate event listeners.
- Unnecessary repeated API requests.

### UI Review Principles

When reviewing UI:

- Follow `docs/DESIGN_SYSTEM.md`.
- Follow `.agents/skills/frontend-design/SKILL.md`.
- Follow `.agents/skills/frontend-development/SKILL.md`.
- Follow `.agents/skills/accessibility/SKILL.md`.

Evaluate the interface based on:

- Visual hierarchy.
- Information clarity.
- Consistency with the brand.
- Page-specific layout suitability.
- Responsive behavior.
- Accessibility.
- Interaction quality.

Do not consider a page successful merely because it uses the correct brand colors.

Do not force every page into the same visual composition.

## 6. Database Review

Check:

- SQLAlchemy model consistency.
- Primary and foreign keys.
- Nullable fields.
- Unique constraints.
- Data types.
- Default values.
- Migration safety.
- Transaction handling.
- Query correctness.
- Data integrity.

Respect the approved 15-table database structure.

Never recommend unapproved schema changes as automatic fixes.

Do not automatically add:

- Tables.
- Columns.
- Indexes.
- Foreign keys.
- Unique constraints.
- CHECK constraints.
- Inventory history structures.

Any structural database change requires explicit approval.

### Data Safety

Before running database tests:

- Identify the target database.
- Determine whether the test can modify data.
- Prefer an isolated test database.
- Avoid destructive operations.
- Preserve existing development and production data.

Do not run tests that reset, truncate, or drop database structures without explicit authorization.

## 7. API Integration Review

When frontend and backend communicate:

- Verify the actual API endpoint.
- Verify HTTP methods.
- Verify request payloads.
- Verify response structure.
- Verify authentication headers.
- Verify error responses.
- Verify data types.
- Verify loading and failure behavior.
- Verify authorization requirements.
- Verify frontend handling of unsuccessful responses.

Inspect both frontend and backend implementations.

Do not assume frontend and backend contracts match without checking both sides.

Do not invent endpoints or response fields to make an integration appear complete.

### API Workflow Verification

For important workflows, verify the complete flow:

1. User interaction.
2. Frontend validation.
3. API request.
4. Backend authentication and authorization.
5. Backend validation and business logic.
6. Database operation.
7. API response.
8. Frontend state update.
9. User feedback.

A successful API request alone does not prove that the entire workflow works correctly.

## 8. Testing Strategy

Choose tests based on the affected functionality.

Do not run unrelated tests simply to produce a large test report.

### 8.1. Backend

Appropriate checks include:

- Python syntax checks.
- Import checks.
- Flask application startup.
- Unit tests.
- API tests.
- Authentication tests.
- Authorization tests.
- Database operation tests.
- Validation tests.
- Error handling tests.

### 8.2. Frontend

Appropriate checks include:

- JavaScript syntax checks.
- HTML structure checks.
- Browser console inspection.
- Navigation tests.
- Form validation tests.
- API integration tests.
- Responsive layout checks.
- Interaction tests.
- Accessibility checks.

### 8.3. Database

Appropriate checks include:

- Model consistency checks.
- Migration checks.
- Relationship checks.
- Transaction tests.
- Data persistence checks.
- Query behavior checks.

### 8.4. Test Selection

Choose the smallest set of tests that provides sufficient evidence.

Prioritize:

1. Tests for the changed functionality.
2. Tests for directly affected dependencies.
3. Regression tests for important existing workflows.
4. Broader tests when the change has a wider impact.

If automated tests are unavailable, perform appropriate manual verification and clearly report the limitation.

Do not invent test results.

## 9. Bug Investigation Workflow

When a bug is reported:

1. Reproduce the issue when possible.
2. Identify the affected component.
3. Inspect related code and dependencies.
4. Examine relevant error messages and logs.
5. Find the root cause.
6. Determine the smallest safe fix.
7. Implement the fix.
8. Run relevant regression tests.
9. Verify that the original issue is resolved.
10. Report the result.

Do not randomly change multiple files to hide a symptom.

Do not treat suppressing an error message as fixing the underlying problem.

When the issue cannot be reproduced:

- Explain what was inspected.
- Identify possible causes.
- State what additional evidence is needed.
- Do not claim that the issue has been resolved.

## 10. Regression Prevention

After modifying existing functionality:

- Check related pages and components.
- Check dependent API calls.
- Check shared CSS and JavaScript.
- Check database interactions.
- Check authentication and authorization behavior.
- Check existing user workflows.
- Check responsive behavior when UI is affected.

Avoid unnecessary rewrites.

Preserve unrelated functionality.

Pay particular attention to shared components and global styles because changes to them may affect multiple pages.

Do not claim that regression testing is complete if only the modified file was checked.

## 11. Review Report Format

Use this structure:

### Summary

Briefly describe:

- Review scope.
- Main files or features reviewed.
- Overall assessment.

### Findings

For each finding, report:

- Severity.
- Classification: Bug, Potential Risk, or Improvement.
- File and relevant function or code location.
- Explanation.
- Impact.
- Recommended correction.

Order findings by severity.

Do not report speculative issues as confirmed defects.

### Verification

List:

- Commands executed.
- Tests executed.
- Relevant test results.
- Manual checks performed.
- Checks that could not be performed.

Distinguish clearly between successful, failed, and unperformed checks.

### Remaining Risks

Identify issues that could not be verified.

If no issue is found, state:

"No issue was identified within the reviewed scope."

Do not claim that the entire system is error-free.

## 12. Rules for Fixing Issues

- Fix only issues within the requested scope.
- Avoid changing unrelated functionality.
- Preserve existing architecture.
- Do not introduce unnecessary dependencies.
- Do not modify approved business rules.
- Ask before making database schema changes.
- Explain significant trade-offs before implementing risky fixes.
- Inspect affected files before editing.
- Prefer minimal, targeted changes.
- Verify the fix after implementation.
- Preserve existing API contracts unless a change is approved.

Do not automatically fix every improvement suggestion.

Separate necessary bug fixes from optional refactoring.

## 13. Final Principles

- Correctness before speed.
- Security before convenience.
- Evidence before assumptions.
- Root cause before symptoms.
- Minimal changes before large rewrites.
- Data integrity before implementation convenience.
- Tested behavior before completion claims.
- Honest reporting before optimistic reporting.

A review is complete only when its scope, findings, verification, and remaining risks are clearly communicated.