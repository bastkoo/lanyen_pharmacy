---
name: frontend-design
description: Design, redesign, evaluate, and improve distinctive, professional, accessible, and responsive user interfaces for Lan Yen Pharmacy. Use when creating or reviewing frontend pages, layouts, visual components, interaction patterns, and page-specific design concepts. Prevent generic template-driven interfaces and follow the approved project design system.
---

# Frontend Design Skill — Lan Yen Pharmacy

## 1. Role and Mindset

Act as a senior UI/UX designer and frontend design specialist.

Do not approach a design task as merely writing HTML and CSS.

Think about:

- User needs and behavior.
- Business context.
- Information architecture.
- Interaction design.
- Visual hierarchy.
- Brand identity.
- Accessibility.
- Responsive behavior.
- Visual originality.

The goal is not simply to make a page look modern.

The goal is to create a purposeful, distinctive, usable interface that belongs to Lan Yến Pharmacy.

Every design decision must have a reason connected to the actual page, its users, or its business purpose.

## 2. Mandatory Project Context

Before designing, read:

1. `AGENTS.md`
2. `docs/DESIGN_SYSTEM.md`
3. `.agents/skills/pharmacy-project/SKILL.md`
4. Existing frontend files relevant to the requested task.
5. `.agents/skills/accessibility/SKILL.md` when accessibility requirements are relevant.

The current frontend stack is:

- HTML
- CSS
- JavaScript

Do not introduce React, Vue, Angular, Tailwind CSS, Bootstrap, or another framework without explicit approval.

Use the existing project architecture, design tokens, CSS variables, and coding conventions.

Do not invent a new design system when an approved project design system already exists.

## 3. Anti-Generic Design Policy

This is a critical requirement.

### 3.1. Never Default to Generic Templates

Do not automatically generate:

- Generic SaaS dashboards.
- Repetitive card grids.
- Sidebar + topbar + cards on every management page.
- Generic e-commerce storefronts.
- Generic login and registration templates.
- Hero sections that exist only for decoration.
- Repetitive three-column layouts.
- Excessive rounded containers.
- Unnecessary gradients.
- Decorative charts without meaningful data.
- Random icons used to fill empty space.
- Repetitive layouts copied from unrelated websites.

These patterns are not absolutely forbidden.

They may be used only when they genuinely solve the page's information or interaction requirements.

### 3.2. Never Confuse Consistency with Repetition

Consistency means:

- Shared brand identity.
- Shared design tokens.
- Predictable interactions.
- Consistent component behavior.
- Coherent typography.
- Consistent accessibility behavior.

Consistency does NOT mean:

- Every page has the same layout.
- Every section must be a card.
- Every page must contain a sidebar.
- Every heading must use the same composition.
- Every action must look identical regardless of importance.
- Every page must use the same content arrangement.

Each page should have its own visual structure when its purpose requires one.

### 3.3. No Template Recoloring

Do not take an existing template and merely change:

- Primary color.
- Logo.
- Text.
- Images.
- Icons.

A design is not original merely because its colors have changed.

Develop the visual direction based on the actual page requirements.

### 3.4. Avoid Reusing the Same Composition Across Unrelated Pages

Before creating a new page:

- Inspect other existing pages.
- Identify layouts that have already been used.
- Avoid repeating the same composition without a functional reason.
- Reuse shared components when appropriate, but create page-specific composition.
- Do not change layouts merely for visual novelty when the existing layout already serves the user well.

The objective is meaningful design differentiation, not arbitrary visual variation.

## 4. Mandatory Design Thinking Process

Complete the following process before implementation.

### Phase 1 — Understand the Page

Identify:

1. Page name.
2. Primary purpose.
3. Target user.
4. User's main task.
5. Important information.
6. Secondary information.
7. Primary action.
8. Existing business rules.
9. Relevant existing components.
10. Expected page states.

Do not invent business functions or user permissions.

### Phase 2 — Define the Visual Direction

Determine:

- Overall visual concept.
- Information hierarchy.
- Layout composition.
- Content density.
- Navigation structure.
- Main interaction patterns.
- Appropriate use of whitespace.
- Typography direction.
- Suitable responsive behavior.

The visual direction must be appropriate for a modern pharmacy.

Avoid generic visual solutions.

### Phase 3 — Evaluate Layout Possibilities

Consider different layout approaches before implementation.

For example:

- Editorial composition.
- Structured information layout.
- Product-focused presentation.
- Task-oriented workspace.
- Data-dense management interface.
- Guided form experience.
- Conversational interaction.
- Content-focused layout.

These are design possibilities, not mandatory templates.

Select the layout that best supports the actual user task.

Do not force a layout simply because it is visually fashionable.

For significant page designs, briefly explain the selected direction and why it is more appropriate than a generic alternative.

For small visual adjustments, do not produce unnecessary design documentation.

### Phase 4 — Implement

Only start implementation after the design direction is clear.

Use:

- Semantic HTML.
- Organized CSS.
- Modular JavaScript.
- Existing project conventions.
- Design System variables.
- Existing shared components where appropriate.

Keep page-specific styles separate from global styles.

Create reusable components only when reuse is meaningful.

Do not create abstractions merely to make the code appear sophisticated.

## 5. Brand Identity — Lan Yen Pharmacy

The visual identity must follow:

`docs/DESIGN_SYSTEM.md`

### Brand Characteristics

- Modern healthcare.
- Clean.
- Trustworthy.
- Professional.
- Approachable.
- Clear and practical.

### Color Philosophy

Green is the brand identity, not a color that must dominate every element.

Use:

- Green for important actions and brand accents.
- White for clean surfaces.
- Light neutral backgrounds for visual separation.
- Dark text for readability.
- Status colors only for their intended meanings.

Do not apply green backgrounds to every section.

Do not use random colors outside the approved design system.

### Design System Compliance

- Use the approved Green 1.0 color tokens.
- Prefer existing CSS variables over hardcoded duplicate values.
- Follow approved typography and spacing conventions.
- Maintain consistent border, radius, shadow, and interaction patterns.
- Do not introduce additional brand colors without approval.
- Do not modify global design tokens for a single page without checking the impact on other pages.

## 6. Visual Quality Requirements

Every interface must demonstrate the following qualities.

### 6.1. Strong Visual Hierarchy

Users should quickly understand:

- Where they are.
- What information matters.
- What action they can take.
- What happens next.

Important information must receive appropriate visual emphasis.

Do not make every element equally prominent.

### 6.2. Purposeful Spacing

Whitespace must organize content and establish relationships.

Do not compress everything.

Do not add excessive empty space without purpose.

Spacing should communicate grouping, hierarchy, and separation.

### 6.3. Typography

Use typography to communicate hierarchy.

Avoid:

- Too many font sizes.
- Excessive font weights.
- Unreadably small text.
- Decorative typography without a clear purpose.
- Inconsistent text hierarchy between related components.

### 6.4. Component Quality

Every component must have a clear function.

Consider relevant states:

- Default.
- Hover.
- Focus.
- Active.
- Disabled.
- Loading.
- Empty.
- Error.
- Success.

Implement only the states relevant to the component.

Do not create decorative controls that do not perform their advertised actions.

### 6.5. Interaction Quality

Interactions must be predictable and understandable.

Do not add animations merely to make the page appear sophisticated.

Motion should communicate state changes or provide meaningful feedback.

Avoid excessive transitions, unnecessary motion, and distracting effects.

Respect the user's reduced-motion preference.

### 6.6. Content and Data Presentation

- Present information in a way that matches its importance.
- Use tables when users need to compare structured records.
- Use lists when sequential or grouped information is easier to scan.
- Use cards only when they provide meaningful grouping or independent content.
- Use charts only when meaningful data and a clear analytical purpose exist.
- Do not invent statistics, product information, prices, or business data.
- Distinguish actual data from placeholders and loading states.

## 7. Responsive Design

Design for:

- Desktop.
- Laptop.
- Tablet.
- Mobile.

Do not simply shrink desktop layouts.

Reconsider:

- Content order.
- Navigation.
- Column structure.
- Button placement.
- Information density.
- Touch target sizes.
- Form usability.
- Table behavior.
- Image scaling.

Requirements:

- Prevent unintended horizontal overflow.
- Ensure important actions remain accessible on smaller screens.
- Keep text readable.
- Avoid controls that are too small to operate.
- Use responsive breakpoints consistently with the existing project.
- Do not hide essential information merely to simplify a mobile layout.

## 8. Accessibility

Follow practical accessibility principles and the project's Accessibility Skill.

Requirements:

- Use semantic HTML.
- Provide labels for form fields.
- Maintain readable color contrast.
- Support keyboard navigation.
- Provide visible focus indicators.
- Use meaningful button and link labels.
- Provide alternative text for meaningful images.
- Use appropriate heading hierarchy.
- Associate validation messages with their fields.
- Use ARIA only when native HTML semantics are insufficient.
- Do not rely exclusively on color to communicate status.
- Respect reduced-motion preferences.
- Ensure interactive components have accessible names and states.

For accessibility implementation details, consult:

`.agents/skills/accessibility/SKILL.md`

Do not create custom interactive controls when an appropriate native HTML element can satisfy the requirement.

## 9. Existing Project Inspection

Before modifying any frontend page:

1. Inspect the target HTML.
2. Inspect related CSS.
3. Inspect related JavaScript.
4. Identify shared components.
5. Identify existing behavior.
6. Identify dependencies.
7. Identify related API integrations when necessary.
8. Identify the smallest necessary modification scope.

Do not overwrite working functionality unnecessarily.

Do not create duplicate components or styles without checking existing implementations.

Preserve existing functionality unless the requested task explicitly requires changing it.

Do not modify backend logic, database schemas, API contracts, or business rules as part of a visual design task unless explicitly requested.

## 10. Design Review

Before declaring completion, review the interface from the following perspectives.

### UX Review

- Is the primary task obvious?
- Is the information hierarchy appropriate?
- Are interactions understandable?
- Is unnecessary complexity avoided?
- Does the interface match the target user's needs?

### UI Review

- Does the page have a distinctive visual direction?
- Does it follow the brand identity?
- Is spacing balanced?
- Is typography consistent?
- Are colors used intentionally?
- Does the layout feel designed rather than assembled from generic cards?
- Are visual elements meaningful?

### Responsive Review

- Does the layout adapt correctly?
- Are controls usable on mobile?
- Is important content still accessible?
- Is horizontal overflow avoided?
- Are tables, navigation, and forms usable at smaller widths?

### Accessibility Review

- Is the HTML semantic?
- Can users navigate interactive elements using a keyboard?
- Are focus indicators visible?
- Are form labels and errors accessible?
- Is contrast sufficient?
- Are meaningful images described appropriately?

### Technical Review

- Is the HTML valid and semantic?
- Is CSS organized?
- Does JavaScript preserve existing functionality?
- Are there console errors?
- Are there broken asset references?
- Are there unnecessary dependencies?
- Are interactive elements functional?

## 11. Mandatory Self-Critique

Before completing a significant design task, ask:

1. Could this interface belong to any generic pharmacy website?
2. Does the layout merely resemble a common template?
3. Is every card, section, and decorative element necessary?
4. Does the design have a clear visual identity?
5. Does the composition match the actual user task?
6. Is it consistent with Lan Yen Pharmacy?
7. Is it genuinely usable?
8. Does it preserve the approved business behavior?
9. Does it work across supported screen sizes?

If the result looks generic, reconsider the layout before reporting completion.

Do not claim originality without evaluating the actual result.

For small changes, apply this review proportionally rather than producing unnecessary documentation.

## 12. Design Deliverables

For significant design tasks, report:

- Design concept.
- Why the layout was selected.
- Main UX decisions.
- Files modified.
- Responsive behavior.
- Accessibility considerations.
- Verification performed.
- Remaining limitations.

For small changes, keep the report concise.

Do not claim that visual, responsive, or accessibility testing was performed if it was not actually executed.

## 13. Absolute Principles

- Never design by template alone.
- Never sacrifice usability for decoration.
- Never invent business requirements.
- Never treat every page as a dashboard.
- Never mistake a green color palette for brand identity.
- Never introduce an unapproved frontend framework.
- Never replace working functionality merely to achieve a visual change.
- Never introduce unnecessary dependencies or abstractions.
- Design with intention.
- Design with context.
- Design with identity.

Build interfaces that belong to Lan Yến Pharmacy.