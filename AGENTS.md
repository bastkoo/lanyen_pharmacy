# LAN YEN PHARMACY
# PROJECT AGENT INSTRUCTIONS

**Version:** 1.1  
**Project:** Lan Yến Pharmacy

---

## 1. PROJECT OVERVIEW

**Project name:** Lan Yến Pharmacy

**Project type:** Online Pharmacy Management System.

### 1.1. Technology Stack

**Backend**
- Python
- Flask
- Flask REST API
- SQLAlchemy
- Flask-Migrate

**Database**
- PostgreSQL

**Frontend**
- HTML
- CSS
- JavaScript (Vanilla JavaScript)

Do not introduce another framework, library, or technology without explicit user approval.

### 1.2. Project Documentation

The following documents define the project's requirements and implementation standards:

- `AGENTS.md`: Global project instructions.
- `docs/DESIGN_SYSTEM.md`: Official visual identity and design specifications.
- `.agents/skills/pharmacy-project/SKILL.md`: Approved business requirements, roles, workflows, and project boundaries.
- `.agents/skills/`: Specialized instructions for development, design, accessibility, database management, and testing.

Agents must inspect relevant documentation before performing tasks that depend on it.

---

## 2. MANDATORY PROJECT RULES

All AI agents working on this project must follow these rules.

### 2.1. Respect Existing Architecture

- Inspect the existing project before modifying code.
- Follow the current folder structure and architectural conventions.
- Reuse existing modules and utilities when appropriate.
- Do not arbitrarily create new folders or files.
- Do not move, rename, or delete existing files without authorization.
- Do not introduce unnecessary dependencies.
- Do not introduce another architectural pattern without approval.
- Maintain clear separation of responsibilities between modules.

### 2.2. Respect Business Requirements

- Follow the approved business requirements.
- Do not invent additional business functions.
- Do not remove existing functionality.
- Do not change business workflows without approval.
- Do not assume missing requirements.
- Do not create business rules based on personal assumptions.
- Ask for clarification when a requirement is ambiguous.
- Preserve existing business behavior unless the user explicitly requests a change.

### 2.3. Database Protection

The approved PostgreSQL database schema is the project's baseline and must be protected.

The approved schema currently contains 15 tables. Refer to `.agents/skills/pharmacy-project/SKILL.md` and the approved database specification for their definitions.

Agents must not perform any of the following without explicit user approval:

- Add or delete tables.
- Add or delete columns.
- Rename existing tables or columns.
- Change column data types.
- Change nullable or default settings.
- Change primary keys or foreign keys.
- Add, remove, or modify database constraints.
- Add, remove, or modify indexes.
- Change relationships between existing entities.
- Change existing database behavior or data semantics.
- Introduce additional tables for features that have not been approved.

Additional rules:

- Do not introduce database constraints based on assumptions.
- Do not create unnecessary database tables or fields.
- Do not modify the approved schema merely to simplify implementation.
- Do not generate migrations that introduce unapproved schema changes.
- Do not execute destructive database operations without explicit permission.
- Do not delete, truncate, or overwrite existing data without explicit permission.

Any proposed database modification must be explained before implementation, including its purpose, affected objects, and potential impact.

Implementation must remain consistent with the approved database specification and existing migration history.

### 2.4. Scope Control

- Modify only files necessary for the requested task.
- Avoid unrelated refactoring.
- Do not rewrite working modules without a clear reason.
- Preserve existing behavior unless the request requires a change.
- Do not introduce additional functionality outside the requested scope.
- Explain important modifications.
- Keep changes as small and focused as reasonably possible.

---

## 3. DESIGN SYSTEM COMPLIANCE

The official design document is:

`docs/DESIGN_SYSTEM.md`

Every frontend implementation must follow this document.

### 3.1. Mandatory Requirements

- Use the official Green 1.0 color tokens.
- Maintain consistent brand identity.
- Follow the defined typography system.
- Follow spacing and layout conventions.
- Ensure responsive behavior.
- Maintain accessibility.
- Use meaningful visual hierarchy.
- Maintain consistency between related pages and components.

### 3.2. Design Restrictions

- Do not introduce a separate visual identity without approval.
- Do not arbitrarily change the official color palette.
- Do not repeatedly hardcode brand colors.
- Do not create inconsistent typography or spacing systems.
- Do not introduce unnecessary UI libraries or design frameworks.

When the Design System does not define a specific design decision, choose a solution consistent with its existing principles.

---

## 4. NON-GENERIC UI REQUIREMENTS

This section has high priority for all frontend design and implementation agents.

### 4.1. Never Design by Default Template

Do not automatically generate:

- Generic dashboard layouts.
- Repetitive card grids.
- Sidebar + header + card layouts.
- Generic e-commerce templates.
- Unnecessary hero sections.
- Decorative charts without business value.
- Repetitive layouts across unrelated pages.
- Interfaces that simply resemble common admin templates.

These patterns are not forbidden when genuinely appropriate.

However, their use must be justified by the page's purpose, information structure, and user workflow.

### 4.2. Analyze Before Implementing

Before creating or modifying a page, identify:

1. Page purpose.
2. Target user.
3. Main user actions.
4. Information hierarchy.
5. Suitable layout.
6. Responsive behavior.
7. Relevant interaction patterns.
8. Visual direction consistent with the brand.

### 4.3. Design with Intention

- Each page must have a layout suited to its function.
- Different pages may use different layout compositions.
- Do not simply change colors, text, icons, or images of an existing template and call it a custom design.
- Avoid repeating the same component composition across unrelated pages.
- Use visual elements to support actual user tasks.

### 4.4. Quality over Decoration

- Avoid unnecessary gradients.
- Avoid excessive shadows.
- Avoid excessive rounded cards.
- Avoid meaningless animations.
- Avoid decorative elements that reduce usability.
- Avoid unnecessary visual complexity.
- Prioritize clarity, usability, accessibility, and visual identity.

### 4.5. Page-Specific Design

For each page:

- Understand its specific workflow.
- Select a suitable information hierarchy.
- Choose an appropriate layout instead of reusing a generic template by default.
- Use components that serve the page's actual purpose.
- Maintain consistency with the overall Design System without making every page visually identical.

---

## 5. FRONTEND DEVELOPMENT RULES

### 5.1. Technology

The frontend uses:

- HTML
- CSS
- Vanilla JavaScript

Do not introduce React, Vue, Angular, Tailwind CSS, Bootstrap, or another frontend framework without explicit approval.

### 5.2. HTML

- Use semantic HTML.
- Use appropriate elements for their intended purposes.
- Maintain a logical heading hierarchy.
- Provide meaningful labels for form controls.
- Ensure interactive elements are keyboard accessible.
- Avoid unnecessary markup.

### 5.3. CSS

- Keep CSS organized according to the existing folder structure.
- Use CSS variables from the official Design System.
- Avoid repeatedly hardcoding brand colors.
- Avoid unnecessary inline CSS.
- Avoid duplicated styles.
- Keep global styles separate from page-specific styles.
- Use responsive layouts appropriate to each page.
- Avoid introducing an additional CSS framework without approval.

### 5.4. JavaScript

- Use modular JavaScript according to the existing architecture.
- Reuse components and utilities when appropriate.
- Avoid unnecessary global variables.
- Avoid duplicated logic.
- Handle asynchronous operations and errors appropriately.
- Use safe DOM manipulation methods.
- Avoid unsafe HTML injection.
- Keep API communication separate from presentation logic when appropriate.

### 5.5. Accessibility

- Follow applicable WCAG 2.2 AA requirements.
- Ensure keyboard accessibility.
- Maintain sufficient color contrast.
- Provide visible focus indicators.
- Use accessible forms and error messages.
- Do not rely on color alone to communicate information.
- Use appropriate accessible names for interactive elements.

Refer to `.agents/skills/accessibility/SKILL.md` for detailed accessibility requirements.

---

## 6. BACKEND DEVELOPMENT RULES

### 6.1. Architecture

Follow the existing Flask application structure.

Keep responsibilities separated according to the established architecture:

- Routes
- Controllers
- Services
- Repositories
- Models
- Schemas
- Utilities

Do not place all business logic inside route handlers.

Do not introduce additional architectural layers without a clear reason and user approval when they materially change the architecture.

### 6.2. Implementation

- Reuse existing Flask extensions.
- Follow existing application configuration.
- Validate incoming data.
- Handle errors consistently.
- Keep database operations within the appropriate layer.
- Avoid duplicated business logic.
- Maintain consistency with existing API contracts.
- Protect sensitive configuration.
- Never expose secrets or database credentials.

### 6.3. API Compatibility

- Do not change existing API endpoints without approval.
- Do not change request or response structures without approval.
- Do not change authentication behavior without approval.
- Coordinate frontend and backend changes when an API contract needs modification.
- Preserve backward compatibility where required.

### 6.4. Security

- Apply appropriate authentication and authorization.
- Validate and sanitize input according to its intended use.
- Prevent SQL injection and unsafe query construction.
- Prevent unauthorized access to resources.
- Protect sensitive information.
- Avoid exposing internal errors and stack traces to clients.
- Follow the detailed security instructions in `.agents/skills/flask-backend/SKILL.md`.

---

## 7. CODE QUALITY

All generated or modified code must:

- Be readable.
- Have meaningful names.
- Follow the existing coding style.
- Avoid unnecessary complexity.
- Avoid duplicated logic.
- Handle expected errors.
- Avoid unused code.
- Avoid unexplained hardcoded values.
- Follow the project's architecture.
- Be maintainable and understandable.

Additional requirements:

- Do not introduce abstractions without a practical reason.
- Do not create unnecessary helper files or modules.
- Do not silently suppress errors.
- Do not claim code works without appropriate verification.
- Do not make unrelated improvements while implementing a narrowly scoped request.

---

## 8. TESTING AND VERIFICATION

After implementation, perform appropriate verification.

### 8.1. Verification Checklist

1. Review all modified files.
2. Check imports and dependencies.
3. Check syntax.
4. Run relevant tests when available.
5. Verify affected functionality.
6. Check API compatibility when applicable.
7. Check database consistency when applicable.
8. Check responsive behavior for frontend changes.
9. Check accessibility for relevant UI changes.
10. Check for unintended changes.

### 8.2. Testing Principles

- Test the functionality affected by the changes.
- Include relevant success and failure scenarios.
- Check permission boundaries when authentication or authorization is involved.
- Avoid destructive operations on existing data.
- Do not modify production data for testing.
- Do not claim that tests passed if they were not executed.

If a test cannot be executed, explicitly state:

- Which test was not executed.
- Why it could not be executed.
- What remains unverified.

Refer to `.agents/skills/code-review-testing/SKILL.md` for detailed review and testing procedures.

---

## 9. WORKING PROCEDURE

For each task, follow this workflow.

### Phase 1: Understand

- Read the user's request carefully.
- Inspect relevant project files.
- Read applicable documentation and Agent Skills.
- Identify existing behavior and dependencies.

### Phase 2: Analyze

- Identify the affected modules.
- Understand the existing implementation.
- Identify potential risks.
- Check whether the task affects business requirements, database structure, architecture, or API contracts.

### Phase 3: Plan

- Determine which files need modification.
- Define the minimum necessary changes.
- Identify appropriate verification methods.
- Avoid unrelated changes.

### Phase 4: Confirm

Obtain explicit user approval before making changes that:

- Modify the approved database schema.
- Change business requirements or workflows.
- Change existing API contracts.
- Introduce another framework or technology.
- Change the established architecture.
- Perform destructive operations.
- Expand the requested scope materially.

Do not request unnecessary confirmation for routine implementation details that are already covered by approved requirements.

### Phase 5: Implement

- Follow the approved plan.
- Modify only necessary files.
- Follow relevant project documentation and Skills.
- Preserve existing functionality.
- Avoid unnecessary refactoring.

### Phase 6: Verify

- Review the implementation.
- Run appropriate tests and checks.
- Verify affected functionality.
- Identify remaining risks or limitations.

### Phase 7: Report

Summarize:

- What was changed.
- Which files were modified.
- Why the changes were necessary.
- What was tested.
- What was not tested.
- Any remaining issues.

---

## 10. COMMUNICATION RULES

- Communicate clearly and directly.
- Do not hide implementation risks.
- Do not make assumptions about business requirements.
- Ask questions when necessary.
- Explain technical decisions in understandable language.
- Do not overwhelm the user with unrelated suggestions.
- Prefer incremental implementation for multi-step tasks.
- Give clear instructions when the user needs to perform a manual action.
- Distinguish confirmed facts from assumptions and recommendations.
- Do not report successful completion without evidence.

For multi-step tasks, complete one logical step at a time and wait for the user's feedback when necessary.

---

## 11. AGENT SKILL COORDINATION

The project contains specialized Agent Skills under `.agents/skills/`.

Agents must use the relevant Skills instead of treating every task as a generic coding task.

### 11.1. Available Skills

| Skill | Primary Responsibility |
|---|---|
| `pharmacy-project` | Business requirements, roles, workflows, and project boundaries |
| `frontend-design` | Visual design, page composition, and non-generic UI |
| `frontend-development` | HTML, CSS, JavaScript implementation |
| `flask-backend` | Flask backend implementation and API security |
| `database-postgresql` | PostgreSQL, SQLAlchemy, and migration management |
| `accessibility` | Accessibility and WCAG requirements |
| `web-design-guidelines` | UI quality review and interface guidelines |
| `code-review-testing` | Code review, testing, and verification |

### 11.2. Skill Selection

- Read `pharmacy-project` when a task involves business requirements or project rules.
- Read `frontend-design` when designing or changing page layouts and visual interfaces.
- Read `frontend-development` when implementing frontend functionality.
- Read `flask-backend` when working on backend routes, services, authentication, or APIs.
- Read `database-postgresql` when working with models, queries, or migrations.
- Read `accessibility` when implementing or reviewing accessible interfaces.
- Read `web-design-guidelines` when auditing UI quality and interface consistency.
- Read `code-review-testing` when reviewing code, fixing bugs, or verifying functionality.

Multiple Skills may be required for tasks that cross architectural boundaries.

### 11.3. Skill Coordination Rules

- Use only Skills relevant to the current task.
- Do not blindly apply every Skill to every task.
- Follow the project's approved architecture and business requirements.
- Specialized Skills provide detailed procedures within their respective responsibilities.
- A specialized Skill must not override explicit user requirements or approved project decisions.
- Avoid duplicate or contradictory instructions across Skills.
- If two Skills appear to conflict, resolve the conflict using the priority order in Section 12.

---

## 12. PRIORITY ORDER

When instructions conflict, follow this priority order:

1. Explicit user requirements and latest user-approved decisions.
2. Approved business requirements and database specifications.
3. Existing project architecture and established implementation decisions.
4. `AGENTS.md` for global project rules.
5. `docs/DESIGN_SYSTEM.md` for frontend visual design decisions.
6. Relevant specialized Agent Skills for detailed implementation procedures.
7. General coding conventions and external best practices.

### Additional Priority Rules

- A lower-priority instruction must never override a higher-priority requirement.
- External Skills and general best practices are recommendations, not permission to change approved project decisions.
- Do not introduce additional requirements merely because a Skill or external guideline recommends them.
- When an instruction conflicts with an approved requirement, follow the approved requirement and explain the conflict if it affects implementation.
- When requirements are ambiguous, ask the user instead of inventing a decision.

---

## 13. FINAL PRINCIPLES

Understand before coding.

Respect the business.

Preserve the architecture.

Protect the approved database.

Follow the Design System.

Design with identity.

Avoid generic interfaces.

Use the appropriate Agent Skills.

Change only what is necessary.

Verify before reporting completion.