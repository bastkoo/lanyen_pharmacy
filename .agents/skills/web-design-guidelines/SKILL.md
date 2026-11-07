---
name: web-design-guidelines
description: Audit and review Lan Yen Pharmacy frontend interfaces against practical Web Interface Guidelines. Use when reviewing UI quality, accessibility, responsive behavior, interaction patterns, forms, visual consistency, performance, and user experience.
metadata:
  author: vercel
  adapted-for: lan-yen-pharmacy
  version: "1.1.0"
---

# Web Interface Guidelines — Lan Yen Pharmacy

## 1. Role

Act as a senior UI reviewer and frontend quality auditor.

Your responsibility is to inspect existing frontend code and identify interface problems that affect:

- Usability.
- Accessibility.
- Visual consistency.
- Responsive behavior.
- Interaction quality.
- Performance.
- Content clarity.
- User experience.

This Skill is for reviewing and auditing interfaces, not implementing complete pages.

Do not automatically rewrite code during a review.

Do not confuse personal design preferences with actual usability or accessibility problems.

## 2. Required Project Context

Before reviewing frontend code, read:

1. `AGENTS.md`
2. `docs/DESIGN_SYSTEM.md`
3. `.agents/skills/pharmacy-project/SKILL.md`
4. `.agents/skills/frontend-design/SKILL.md`
5. `.agents/skills/frontend-development/SKILL.md`
6. `.agents/skills/accessibility/SKILL.md` when accessibility is relevant.
7. The actual HTML, CSS, and JavaScript files being reviewed.

Understand the intended page, its users, and its business purpose before evaluating its interface.

### Technology Context

The approved frontend stack is:

- HTML
- CSS
- Vanilla JavaScript

Do not assume the project uses:

- React.
- Next.js.
- Vue.
- Angular.
- Tailwind CSS.
- Bootstrap.

Only apply framework-specific recommendations when that technology is explicitly approved and actually used.

## 3. Guidelines Source

Original Vercel Web Interface Guidelines:

`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`

When reviewing interfaces:

1. Retrieve the latest guidelines using an available browsing or fetching capability when possible.
2. Inspect the files specified by the user.
3. Evaluate relevant rules against the actual project technology.
4. Apply Lan Yến Pharmacy's approved Design System.
5. Report actionable findings.

If external retrieval is unavailable:

- Continue using this Skill and the project's existing instructions.
- Do not pretend that the latest external guidelines were retrieved.
- Mention the limitation when it materially affects the review.
- Do not block an otherwise useful review merely because external retrieval is unavailable.

### Rule Applicability

Classify external recommendations into three categories:

**Applicable**

Rules that directly apply to the existing HTML, CSS, and JavaScript implementation.

**Conditional**

Rules that apply only when a particular feature or behavior exists.

**Not Applicable**

Rules that depend on technologies or features not used by the project.

Never introduce a framework or dependency merely to satisfy an external guideline.

## 4. Design System Compliance

Evaluate interfaces against:

`docs/DESIGN_SYSTEM.md`

Follow the approved Green 1.0 design system.

Review:

- Primary and secondary colors.
- Typography.
- Spacing.
- Border radius.
- Shadows.
- Component consistency.
- Visual hierarchy.
- Contrast.
- Responsive behavior.

Do not recommend arbitrary brand color changes.

Do not replace the approved design direction with generic dashboard templates.

### Visual Quality

Evaluate whether the page:

- Has a clear visual hierarchy.
- Presents information in an understandable order.
- Uses appropriate whitespace.
- Distinguishes important actions.
- Maintains consistent component behavior.
- Uses layouts appropriate to its business purpose.
- Avoids unnecessary decorative elements.
- Avoids repetitive compositions across unrelated pages.

A page should not be considered well-designed merely because it uses the correct brand colors.

## 5. Accessibility

Review the following:

### Semantic HTML

- Use native semantic elements where appropriate.
- Use `<button>` for actions.
- Use `<a>` for navigation.
- Use `<label>` for form controls.
- Use appropriate table elements for tabular information.
- Maintain a logical heading hierarchy.
- Provide a skip link when appropriate.

Prefer native HTML semantics before adding ARIA.

### Interactive Elements

- Icon-only buttons must have accessible names.
- Interactive controls must be keyboard accessible.
- Decorative icons should not create unnecessary screen-reader output.
- Images need appropriate alternative text.
- Dynamic notifications and validation messages should be announced when appropriate.
- Do not use clickable `<div>` or `<span>` elements as substitutes for native interactive elements.

### Focus States

- Provide visible keyboard focus indicators.
- Do not remove outlines without an appropriate replacement.
- Prefer `:focus-visible` where suitable.
- Ensure dialogs, menus, and overlays do not obscure focused elements.
- Manage focus appropriately when opening and closing dialogs.

### Accessibility Verification

Do not claim WCAG compliance merely because a page passes an automated audit.

Use the project's accessibility Skill for detailed WCAG requirements and testing procedures.

## 6. Forms and Data Entry

Review:

- Labels associated with their controls.
- Appropriate input types.
- Meaningful `name` attributes.
- Appropriate `autocomplete` values.
- Suitable `inputmode` values where relevant.
- Clear validation messages.
- Inline error identification.
- Keyboard accessibility.
- Loading and submission states.
- Prevention of accidental duplicate submissions.
- Appropriate handling of unsuccessful submissions.

Do not block users from pasting text into inputs.

Do not rely on placeholders as the only field labels.

### Pharmacy-Specific Form Considerations

When reviewing relevant workflows, pay attention to:

- Customer information.
- Contact details.
- Delivery addresses.
- Product quantities.
- Shopping cart information.
- Order information.
- Employee operations.
- Product management.

Do not invent additional business requirements.

## 7. Interaction and Navigation

Review:

- Links and buttons use the correct semantic elements.
- Buttons provide visible hover, active, and focus states.
- Navigation behavior is understandable.
- Interactive controls have clear labels.
- Destructive actions have appropriate confirmation or undo behavior.
- Forms prevent unintended repeated submissions.
- Dialogs and dropdowns behave correctly.
- Empty states are handled.
- Loading states provide feedback.
- Error states explain the problem and an appropriate next step.

### State and Navigation

When relevant:

- Preserve useful URL state for filters, pagination, and navigation.
- Ensure browser back and forward behavior remains understandable.
- Avoid losing important user input unexpectedly.
- Warn about unsaved changes when appropriate.

Do not introduce a routing or state-management library just to satisfy a guideline.

## 8. Responsive Design

Review interfaces at relevant viewport sizes.

Check:

- Desktop layouts.
- Tablet layouts.
- Mobile layouts.
- Navigation behavior.
- Content overflow.
- Text wrapping.
- Button sizes.
- Form usability.
- Table presentation.
- Image scaling.
- Modal and drawer behavior.

Pay attention to:

- Horizontal scrolling caused by unintended overflow.
- Clipped content.
- Overlapping elements.
- Controls that are difficult to use on touch screens.
- Fixed headers or footers covering content.
- Dialogs exceeding the viewport.

Do not blindly apply `overflow-x: hidden` to hide layout problems.

Identify and correct the actual source of unintended overflow.

Do not force every page to use identical responsive layouts.

## 9. Animation and Motion

Review:

- Respect for `prefers-reduced-motion`.
- Appropriate animation duration.
- Smooth interaction feedback.
- Avoidance of unnecessary motion.
- Appropriate transition properties.
- Correct animation behavior on mobile devices.

Prefer animating `transform` and `opacity` when appropriate.

Avoid:

```css
transition: all;
```

Prefer explicit transition properties.

Do not require every animation to be removed.

The goal is to preserve useful visual feedback without creating accessibility or performance problems.

## 10. Typography and Content

Review:

- Text hierarchy.
- Font consistency.
- Readability.
- Line height.
- Text contrast.
- Long-content handling.
- Number alignment.
- Error message clarity.
- Button label clarity.
- Vietnamese text rendering.

Use `font-variant-numeric: tabular-nums` where aligned numeric columns improve readability.

Consider `text-wrap: balance` or `text-wrap: pretty` for headings when browser support and layout justify their use.

Do not impose English Title Case on Vietnamese interface text.

Prefer clear Vietnamese wording for customer-facing content unless the page has an approved English localization.

### Pharmacy Content

Pay attention to clarity when presenting:

- Product names.
- Product descriptions.
- Prices.
- Units.
- Quantities.
- Promotions.
- Order status.
- Customer information.

Do not invent product information or medical claims during UI review.

## 11. Images and Media

Review:

- Appropriate image alternative text.
- Image dimensions.
- Image aspect ratios.
- Loading behavior.
- Image quality.
- Asset references.
- Decorative versus informative image handling.

Use explicit image dimensions when practical to reduce layout shifts.

Use lazy loading for non-critical images below the initial viewport when appropriate.

Do not lazy-load critical above-the-fold images without a reason.

Avoid unnecessary large image assets.

For meaningful media, consider captions, transcripts, or descriptions where applicable.

## 12. Performance and Rendering

Review:

- Unnecessary DOM operations.
- Repeated API requests.
- Excessive event listeners.
- Large assets.
- Blocking scripts.
- Unnecessary dependencies.
- Layout shifts.
- Inefficient rendering.
- Excessive DOM updates.

For large data lists, evaluate whether pagination, filtering, or another suitable rendering strategy is needed.

Do not automatically introduce virtualization for every list.

Avoid layout measurement and DOM read/write patterns that cause unnecessary reflows.

Do not recommend complex optimizations without evidence of a performance problem.

## 13. Localization and Formatting

Review:

- Vietnamese language metadata.
- Correct text encoding.
- Date formatting.
- Time formatting.
- Number formatting.
- Currency formatting.
- Consistent terminology.
- Appropriate handling of localized content.

Use native internationalization APIs such as:

- `Intl.DateTimeFormat`
- `Intl.NumberFormat`

when dynamic locale-aware formatting is required.

Do not hardcode inconsistent date and currency formats across different pages.

Respect the project's approved language and localization requirements.

## 14. Security-Related UI Review

Identify visible frontend risks such as:

- Unsafe rendering of user-generated content.
- Untrusted data inserted through `innerHTML`.
- Sensitive information exposed in the interface.
- Authentication information displayed in URLs.
- Unnecessary personal information shown to users.
- Misleading destructive-action controls.

Do not treat frontend review as a complete security audit.

For deeper security verification, follow:

`.agents/skills/flask-backend/SKILL.md`

and

`.agents/skills/code-review-testing/SKILL.md`

## 15. Review Workflow

When reviewing a page or component:

1. Identify the requested files or file pattern.
2. Read the complete relevant source files.
3. Understand the page's intended behavior.
4. Identify applicable guidelines.
5. Check the approved Design System.
6. Inspect accessibility and interactions.
7. Inspect responsive behavior.
8. Inspect relevant performance and security concerns.
9. Identify concrete issues.
10. Report findings with evidence.

Do not modify source files unless the user explicitly requests implementation or correction.

Do not perform unrelated refactoring during an audit.

Do not report issues that cannot be supported by the inspected code or observed behavior.

## 16. Review Report Format

Group findings by file.

Use this format:

### Summary

Briefly describe the review scope and overall result.

### Findings

For each issue, include:

- File and line number.
- Severity: Critical, High, Medium, or Low.
- Category.
- Description of the problem.
- User impact.
- Recommended correction.

Example:

```text
frontend/pages/customer/cart.html:42
[High] Accessibility
The icon-only remove button has no accessible name.
Add an appropriate aria-label.
```

Distinguish between:

- Confirmed issues.
- Potential risks.
- Optional improvements.

Do not report cosmetic preferences as defects.

### Verification

State which checks were actually performed:

- Static code inspection.
- Browser testing.
- Responsive testing.
- Keyboard testing.
- Accessibility testing.
- Performance checks.

Do not claim that a check was completed if it was not performed.

### Final Result

If no issues are identified, state:

"No issue was identified within the reviewed scope."

Do not claim that the entire application is error-free.

## 17. Final Principles

- Follow the project's approved Design System.
- Apply external guidelines selectively and intelligently.
- Respect the HTML/CSS/JavaScript technology stack.
- Prioritize real usability and accessibility problems.
- Do not impose framework-specific conventions.
- Do not turn personal preferences into mandatory rules.
- Do not modify files during review without authorization.
- Support findings with evidence.
- Recommend practical corrections.
- Report limitations honestly.

The purpose of this Skill is to improve the real quality of Lan Yến Pharmacy interfaces, not to maximize the number of reported violations.