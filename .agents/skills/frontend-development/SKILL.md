---
name: frontend-development
description: Implement, maintain, debug, and review the Lan Yen Pharmacy frontend using semantic HTML, modular CSS, and vanilla JavaScript. Use when building or modifying frontend pages, components, layouts, interactions, responsive behavior, API integrations, and browser-side functionality. Follow the approved architecture, design system, accessibility requirements, and backend API contracts.
---

# Frontend Development Skill — Lan Yen Pharmacy

## 1. Role

Act as a senior frontend developer.

Your responsibility is to transform approved UI/UX designs into maintainable, reliable frontend code.

You must understand the existing project before writing code.

Do not treat frontend development as simply generating HTML, CSS, and JavaScript.

Prioritize:

- Maintainability.
- Readability.
- Performance.
- Accessibility.
- Responsive behavior.
- Consistent architecture.
- Reliable interactions.
- Secure API integration.
- Preservation of existing functionality.

The objective is to build a frontend that works reliably and maintains the visual identity of Lan Yến Pharmacy.

## 2. Mandatory Project Context

Read these files before implementation:

1. `AGENTS.md`
2. `docs/DESIGN_SYSTEM.md`
3. `.agents/skills/pharmacy-project/SKILL.md`
4. `.agents/skills/frontend-design/SKILL.md`
5. `.agents/skills/accessibility/SKILL.md` when accessibility requirements are relevant.
6. Relevant existing frontend files.
7. Relevant backend API routes or API documentation when integrating with the backend.

Current technology:

- HTML
- CSS
- Vanilla JavaScript

Do not introduce React, Vue, Angular, Svelte, Tailwind CSS, Bootstrap, or another frontend framework or CSS framework without explicit approval.

Use the existing project architecture and coding conventions.

Do not introduce build tools, package managers, or additional dependencies without a clear technical reason and approval.

## 3. Existing Frontend Architecture

Follow the existing folder structure:

```text
frontend/
├── index.html
├── assets/
│   ├── fonts/
│   ├── icons/
│   └── images/
├── css/
│   ├── base/
│   ├── components/
│   ├── layouts/
│   └── pages/
├── js/
│   ├── api/
│   ├── components/
│   ├── config/
│   ├── layouts/
│   ├── pages/
│   └── utils/
└── pages/
    ├── auth/
    ├── customer/
    ├── employee/
    └── manager/
```

Do not arbitrarily change this architecture.

New files or folders must have a clear technical purpose.

### Directory Responsibilities

**assets/**

- Store project images, icons, and fonts.
- Reuse existing assets when appropriate.
- Keep asset references organized.

**css/base/**

- Store CSS reset, design tokens, variables, and global styles.
- Keep global rules limited to genuinely shared behavior.

**css/components/**

- Store reusable component styles.
- Avoid duplicating styles already provided by existing components.

**css/layouts/**

- Store shared layout styles when multiple pages genuinely need them.

**css/pages/**

- Store page-specific styles.
- Avoid placing unrelated page styles in global files.

**js/api/**

- Store API communication functions.
- Centralize common request handling when appropriate.

**js/components/**

- Store reusable JavaScript UI behavior.

**js/config/**

- Store frontend configuration that is safe to expose to the browser.
- Never store secrets or private credentials here.

**js/layouts/**

- Store shared layout behavior when necessary.

**js/pages/**

- Store page-specific JavaScript logic.

**js/utils/**

- Store genuinely reusable utility functions.

Do not create unnecessary abstractions or duplicate existing modules.

## 4. HTML Development

### 4.1. Semantic HTML

Use appropriate semantic elements:

- `header`
- `nav`
- `main`
- `section`
- `article`
- `aside`
- `footer`
- `form`
- `button`

Do not use `div` for everything.

Use native HTML elements whenever they provide the required functionality.

### 4.2. Structure

- Keep HTML organized.
- Avoid unnecessarily deep nesting.
- Use meaningful class names.
- Avoid duplicate IDs.
- Keep accessibility attributes appropriate.
- Ensure form fields have associated labels.
- Maintain a logical heading hierarchy.
- Use buttons for actions and links for navigation.
- Specify appropriate button types inside forms.
- Avoid unnecessary ARIA attributes when native HTML already provides the required semantics.

### 4.3. Asset References

- Use correct relative paths.
- Reuse existing assets when appropriate.
- Do not invent file paths.
- Do not reference nonexistent images or fonts.
- Use descriptive image alternative text.
- Use empty alternative text for purely decorative images.
- Avoid embedding large image data directly into HTML or CSS without a valid reason.

## 5. CSS Development

### 5.1. Design Tokens

Use the existing design tokens and CSS variables defined by the project.

Inspect the actual CSS files before assuming variable names or values.

Examples:

```css
color: var(--primary-color);
background-color: var(--surface-color);
border-color: var(--border-color);
border-radius: var(--radius-md);
padding: var(--spacing-md);
```

The examples above are illustrative. Use the actual variables available in the project.

Requirements:

- Follow `docs/DESIGN_SYSTEM.md`.
- Prefer existing CSS variables over hardcoded duplicate values.
- Do not repeatedly hardcode brand values.
- Do not introduce alternative brand colors without approval.
- Do not modify global design tokens merely to satisfy one page.
- Preserve the Green 1.0 brand identity.

### 5.2. CSS Organization

Use the existing CSS directories:

- `base/`: reset, variables, global styles.
- `components/`: reusable component styles.
- `layouts/`: shared page layout styles.
- `pages/`: page-specific styles.

Keep global CSS limited to genuinely global rules.

Do not put every page's styles into one large CSS file.

Avoid loading unnecessary stylesheets on unrelated pages when the existing architecture allows page-specific loading.

### 5.3. Naming

Use clear, descriptive class names.

Prefer:

```css
.product-list {}
.product-item {}
.product-price {}
```

Avoid:

```css
.box1 {}
.green-box {}
.item2 {}
```

Use a consistent naming convention within each module.

### 5.4. Avoid CSS Problems

Do not:

- Use excessive `!important`.
- Duplicate existing selectors.
- Create unnecessary global selectors.
- Apply broad styles that unexpectedly affect other pages.
- Use fixed dimensions when flexible dimensions are more appropriate.
- Use excessive absolute positioning.
- Add arbitrary spacing values without reason.
- Override shared component styles without checking their impact.
- Introduce inline styles for large or reusable style definitions.

### 5.5. CSS Maintainability

- Keep selectors reasonably specific.
- Avoid unnecessary selector nesting.
- Group related rules logically.
- Reuse shared styles when appropriate.
- Avoid creating multiple competing definitions for the same component.
- Use responsive CSS that is understandable and maintainable.

## 6. Responsive Development

Use responsive CSS appropriate to each page.

Consider:

- Flexible layouts.
- CSS Grid.
- Flexbox.
- Relative units.
- Media queries.
- Mobile navigation.
- Touch-friendly controls.
- Responsive images.
- Table overflow and alternative mobile presentation.

Do not assume every page requires the same breakpoints.

Do not force desktop layouts onto mobile screens.

Check for:

- Horizontal overflow.
- Clipped content.
- Overlapping elements.
- Unusable buttons.
- Unreadable text.
- Broken forms.
- Inaccessible navigation.
- Tables that cannot be used on smaller screens.

Important functionality and information must remain accessible across supported screen sizes.

## 7. JavaScript Development

### 7.1. Code Organization

Follow the existing JavaScript structure:

- `api/`: API communication.
- `components/`: reusable UI behavior.
- `config/`: frontend configuration.
- `layouts/`: layout behavior.
- `pages/`: page-specific logic.
- `utils/`: shared utilities.

Avoid putting all application logic into one JavaScript file.

Do not introduce a frontend state-management library without approval.

Use native JavaScript features and existing project patterns.

### 7.2. JavaScript Quality

- Use `const` by default.
- Use `let` when reassignment is necessary.
- Avoid unnecessary global variables.
- Use meaningful function names.
- Keep functions focused.
- Avoid duplicated logic.
- Handle expected errors.
- Avoid unnecessary DOM manipulation.
- Prefer modules when supported by the existing project setup.
- Avoid unnecessary dependencies.
- Avoid deeply nested callbacks when clearer alternatives exist.

### 7.3. DOM Handling

- Check whether elements exist before using them.
- Avoid duplicate event listeners.
- Use event delegation when appropriate.
- Avoid unsafe HTML insertion.
- Prefer `textContent` for displaying untrusted text.
- Validate user input appropriately.
- Avoid directly inserting untrusted data through `innerHTML`.
- If HTML rendering is genuinely necessary, use a trusted sanitization approach appropriate to the project.
- Clean up event listeners and other resources when their lifecycle requires it.

### 7.4. Asynchronous Operations

Use `async/await` where appropriate.

Handle:

- Loading states.
- Successful responses.
- Failed requests.
- Network errors.
- Unauthorized responses.
- Forbidden responses.
- Empty responses.
- Unexpected response formats.

Do not silently swallow errors.

Prevent duplicate submissions when an operation is already in progress.

Provide useful feedback without exposing internal technical details to users.

### 7.5. Browser Compatibility

- Prefer standard browser APIs.
- Avoid experimental APIs unless explicitly approved.
- Consider compatibility with the browsers supported by the project.
- Handle unsupported browser features gracefully when necessary.
- Avoid unnecessary polyfills.

## 8. Component Reusability

Create reusable components when they provide genuine value.

Good candidates may include:

- Buttons.
- Form fields.
- Modal dialogs.
- Notifications.
- Navigation elements.
- Product presentation elements.
- Pagination controls.
- Loading indicators.

However:

- Do not abstract every small HTML element.
- Do not create overly complex component systems.
- Do not force unrelated pages to share the same layout.
- Do not reuse components when their behavior or business meaning differs significantly.
- Do not create duplicate components when a suitable implementation already exists.

Reuse code without making interfaces visually repetitive.

Shared components must follow the approved design system and accessibility requirements.

## 9. API Integration

The backend communicates through Flask REST API.

Follow existing API contracts.

Before implementing API calls:

1. Inspect the relevant backend route.
2. Identify the HTTP method.
3. Identify the endpoint URL.
4. Identify required request parameters and body fields.
5. Identify the expected response structure.
6. Identify authentication requirements.
7. Identify possible error responses.

Requirements:

- Use the existing API configuration.
- Centralize common request handling when appropriate.
- Handle HTTP status codes correctly.
- Handle unsuccessful responses.
- Handle network failures.
- Validate input before submission.
- Do not expose secrets.
- Do not hardcode credentials.
- Do not invent endpoint URLs.
- Do not assume response fields without checking the backend contract.
- Do not change backend contracts without approval.

When integrating an endpoint, keep request and response handling consistent with existing frontend API modules.

Do not duplicate the same request configuration across multiple pages without a reason.

### API Error Handling

Distinguish between:

- Validation errors.
- Authentication errors.
- Authorization errors.
- Missing resources.
- Business rule violations.
- Server errors.
- Network failures.

Display user-friendly messages appropriate to each situation.

Do not display raw stack traces, SQL errors, or internal backend messages.

Do not automatically retry non-idempotent operations such as order creation unless retry safety has been established.

## 10. Security

Follow secure frontend development practices.

### 10.1. XSS Prevention

- Avoid inserting untrusted content through `innerHTML`.
- Prefer `textContent` for plain text.
- Treat API responses and user-generated content as untrusted.
- Do not execute dynamically generated code.
- Do not use `eval()` or the `Function()` constructor for application data.
- Use a suitable sanitization approach when rendering approved rich HTML content.

### 10.2. Input Validation

- Validate input for usability before submission.
- Use appropriate HTML input types and constraints.
- Validate data according to actual business requirements.
- Never rely on frontend validation as a security boundary.
- The backend must independently validate all incoming data.

### 10.3. Authentication and Token Handling

- Follow the approved backend authentication design.
- Do not invent a new token storage or refresh strategy.
- Do not hardcode tokens, credentials, or secrets.
- Do not log access tokens or refresh tokens.
- Do not expose authentication information in URLs.
- Use the approved API authentication mechanism.
- Consider XSS and CSRF risks when evaluating token storage and cookie behavior.
- Never assume that storing a token in browser storage is automatically secure.

### 10.4. Sensitive Data

- Do not expose customer or employee information unnecessarily.
- Do not store sensitive personal information without an approved requirement.
- Avoid logging passwords, tokens, and private user data.
- Do not place private credentials in frontend configuration files.
- Remember that all frontend code and configuration delivered to the browser can be inspected by users.

### 10.5. Security Boundaries

- Frontend role checks are for user experience, not authorization.
- Backend authorization remains mandatory.
- Do not rely on hidden buttons or inaccessible frontend routes to protect data.
- Do not modify security-sensitive backend behavior as part of an ordinary frontend task without approval.

For backend security requirements, follow `.agents/skills/flask-backend/SKILL.md`.

## 11. Performance

Avoid unnecessary:

- Large dependencies.
- Repeated DOM queries.
- Duplicate requests.
- Excessive event listeners.
- Unoptimized images.
- Blocking scripts.
- Unnecessary DOM updates.
- Large assets loaded before they are needed.

Requirements:

- Load resources appropriately.
- Use `defer` or suitable module loading where appropriate.
- Optimize images for their actual display dimensions.
- Lazy-load non-critical images when appropriate.
- Avoid unnecessary API requests.
- Keep frontend code simple and efficient.
- Measure performance before introducing complex optimizations.

Do not sacrifice maintainability for premature optimization.

## 12. Modification Rules

Before modifying existing code:

1. Inspect the complete relevant file.
2. Understand its existing behavior.
3. Identify dependencies.
4. Identify affected pages.
5. Identify related API integrations.
6. Identify the smallest necessary modification scope.
7. Check whether shared components or styles are affected.

During implementation:

- Make the smallest necessary change.
- Preserve existing functionality.
- Preserve compatible IDs, classes, function names, and API contracts.
- Avoid unrelated refactoring.
- Do not overwrite working code without a clear reason.
- Do not delete existing features unless explicitly requested.
- Do not change database or backend business logic as part of a frontend-only task.
- Explain compatibility risks before making changes that could affect other pages.

Do not rewrite an entire file when a small modification is sufficient.

## 13. Verification

After implementation, verify the affected functionality.

### Code Checks

- Check HTML structure.
- Check CSS selectors.
- Check JavaScript syntax.
- Check file references.
- Check for duplicate IDs.
- Check for missing assets.
- Check for console errors.

### Functional Checks

- Check navigation.
- Check buttons and forms.
- Check loading states.
- Check API requests.
- Check successful responses.
- Check error handling.
- Check authentication-dependent behavior.
- Check that existing functionality remains intact.

### Responsive Checks

- Check desktop layout.
- Check tablet layout.
- Check mobile layout.
- Check for horizontal overflow.
- Check touch interactions.

### Accessibility Checks

- Check keyboard navigation.
- Check visible focus indicators.
- Check form labels and validation messages.
- Check image alternative text.
- Check color contrast where relevant.

Use browser developer tools and available project testing tools.

Run automated checks when appropriate.

Do not claim successful verification without actually performing it.

## 14. Completion Report

Report:

1. Files created or modified.
2. Main implementation changes.
3. Existing behavior preserved.
4. API integrations affected.
5. Tests or checks performed.
6. Remaining limitations.

Keep reports concise for small changes.

Clearly distinguish between checks that were executed and checks that were not performed.

## 15. Final Principles

- Understand before modifying.
- Write maintainable code.
- Respect the existing architecture.
- Follow the approved Design System.
- Preserve working functionality.
- Use reusable components with intention.
- Follow accessibility and security requirements.
- Integrate with the backend through verified API contracts.
- Avoid unnecessary dependencies and abstractions.
- Never invent business requirements.
- Never sacrifice code quality for speed.

Build a reliable frontend that belongs to Lan Yến Pharmacy.