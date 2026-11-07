---
name: accessibility
description: |
  Build WCAG 2.2 AA compliant interfaces with semantic HTML, ARIA, keyboard navigation, focus management, color contrast, and screen reader support. Covers forms, dialogs, tabs, live regions, skip links, alt text, and data tables.

  Use when implementing accessible UIs, auditing WCAG compliance, fixing screen reader issues, keyboard navigation, focus traps, or troubleshooting "focus outline missing", "aria-label required", "insufficient contrast", "missing alt text", "heading hierarchy".
license: MIT
metadata:
  author: oakoss
  version: '1.1'
user-invocable: false
---

# Web Accessibility (WCAG 2.2 AA)

Build for everyone — accessibility is a requirement, not a feature.

## Contrast Ratios (WCAG AA)

| Element                            | Minimum Ratio |
| ---------------------------------- | ------------- |
| Normal text (< 18pt)               | 4.5:1         |
| Large text (>= 18pt or 14pt bold)  | 3:1           |
| UI components and focus indicators | 3:1           |

## WCAG 2.2 Level AA Criteria

Apply the following WCAG 2.2 Level AA requirements where relevant:

| Criterion | Requirement |
| ----------------------------------- | ---------------------------------------------------------------- |
| Target Size Minimum (2.5.8) | Interactive targets should be at least 24 × 24 CSS pixels, subject to WCAG exceptions |
| Focus Not Obscured Minimum (2.4.11) | Focused components must not be entirely hidden by author-created content |
| Dragging Movements (2.5.7) | Provide a single-pointer alternative for dragging interactions |
| Redundant Entry (3.3.7) | Do not require users to re-enter information already provided in the same process |
| Consistent Help (3.2.6) | Keep help mechanisms in a consistent relative order across pages |
| Accessible Authentication (3.3.8) | Do not require cognitive function tests unless WCAG exceptions apply |

### Additional Level AAA Criterion

Focus Appearance (2.4.13) is a WCAG 2.2 Level AAA criterion, not AA.

Use its stronger focus-indicator guidance as an additional quality target when practical, but do not incorrectly classify it as a mandatory Level AA requirement.

## Essential Keyboard Patterns

| Key             | Action                                |
| --------------- | ------------------------------------- |
| Tab / Shift+Tab | Navigate between focusable elements   |
| Enter / Space   | Activate buttons and links            |
| Arrow keys      | Navigate within widgets (tabs, menus) |
| Escape          | Close dialogs and menus               |
| Home / End      | Jump to first/last item in widget     |

## Element Selection

| Need                   | Element                           |
| ---------------------- | --------------------------------- |
| Navigates to page      | `<a href="...">`                  |
| Submits form           | `<button type="submit">`          |
| Opens dialog           | `<button aria-haspopup="dialog">` |
| Other action           | `<button type="button">`          |
| Self-contained article | `<article>`                       |
| Navigation links       | `<nav>`                           |
| Supplementary info     | `<aside>`                         |

## Common ARIA Attributes

| Attribute              | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `aria-label`           | Name when no visible label exists                  |
| `aria-labelledby`      | Reference existing text as label                   |
| `aria-describedby`     | Additional description (hints, errors)             |
| `aria-live`            | Announce dynamic updates (`polite` or `assertive`) |
| `aria-expanded`        | Collapsible/expandable state                       |
| `aria-hidden="true"`   | Hide decorative elements from screen readers       |
| `aria-invalid`         | Mark form fields with errors                       |
| `aria-required="true"` | Mark required fields                               |
| `aria-busy`            | Indicate loading state                             |

## WCAG 2.2 AA Checklist Summary

| Principle      | Key Requirements                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Perceivable    | Alt text on images, contrast >= 4.5:1, color not sole indicator, text resizable to 200%, captions on video, `prefers-reduced-motion` support |
| Operable       | Keyboard accessible, visible focus not obscured, focus appearance meets minimum, targets >= 24px, skip links, dragging alternatives          |
| Understandable | Use `<html lang="vi">` for Vietnamese pages, maintain consistent navigation and help placement, provide form labels and error identification, avoid redundant entry, and support accessible authentication |
| Robust         | Valid HTML, name/role/value on all UI components, `aria-live` for status messages (SC 4.1.1 Parsing is obsolete in WCAG 2.2)                 |

## Anti-Patterns

| Anti-Pattern                          | Fix                                                  |
| ------------------------------------- | ---------------------------------------------------- |
| `<div onClick>` instead of `<button>` | Use semantic HTML elements                           |
| `outline: none` without replacement   | Use `:focus-visible` with visible outline            |
| Placeholder as label                 | Use `<label>` element                                |
| `tabindex` > 0                        | Use DOM order or `tabindex="0"` / `tabindex="-1"`    |
| Color-only state indicators           | Add icon and text label                              |
| Skipped heading levels                | Use sequential h1-h6, style with CSS                 |
| `role="button"` on `<button>`         | Remove redundant ARIA                                |
| `aria-hidden` on interactive elements | Never hide interactive content                       |
| Inflexible text sizing                | Prefer scalable `rem` units and support text resizing |
| No focus trap in modal dialogs        | Trap focus, close on Escape                          |

## Common Mistakes

| Mistake                                                        | Correct Pattern                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Adding `aria-label` to elements that already have visible text | Use `aria-labelledby` to reference existing visible text instead                                     |
| Using `aria-live="assertive"` for non-urgent updates           | Use `aria-live="polite"` for most dynamic content; reserve `assertive` for errors and alerts         |
| Setting `alt=""` on informative images                         | Provide descriptive alt text; only use empty alt on purely decorative images                         |
| Adding keyboard handlers to non-focusable elements             | Use native interactive elements or add `tabindex="0"` plus `role` and key handlers                   |
| Testing only with automated tools like axe                     | Automated scans catch ~30% of issues; always supplement with keyboard-only and screen reader testing |

## Screen Reader and Browser Pairings

| Screen Reader | Browser | Platform           |
| ------------- | ------- | ------------------ |
| JAWS          | Chrome  | Windows            |
| NVDA          | Chrome  | Windows (free)     |
| NVDA          | Firefox | Windows (free)     |
| VoiceOver     | Safari  | macOS / iOS        |
| TalkBack      | Chrome  | Android            |
| Narrator      | Edge    | Windows (built-in) |

## Testing Quick Guide

| Method | Tool | Purpose |
| ---------------- | -------------------------------- | -------------------------------- |
| Keyboard-only | Browser keyboard navigation | Verify Tab, Shift+Tab, Enter, Space, and Escape |
| Screen reader | NVDA with Chrome or Firefox | Verify labels, headings, landmarks, and announcements |
| Automated scan | axe DevTools | Detect common accessibility issues |
| Lighthouse | Chrome DevTools | Run accessibility audits |
| Responsive testing | Browser DevTools | Verify zoom, reflow, and mobile layouts |
| Manual inspection | Browser DevTools | Inspect focus indicators, contrast, labels, and semantic HTML |

### Testing Rules

- Do not rely exclusively on automated accessibility tools.
- Manually test keyboard navigation and important user workflows.
- Test forms, validation messages, dialogs, navigation, and dynamic content.
- Verify accessibility at different viewport sizes and zoom levels.
- Report actual findings; do not claim WCAG compliance without sufficient testing.
- Do not introduce testing dependencies without checking the project's existing setup.

## Project Technology Guidelines

For Lan Yen Pharmacy, follow these technology constraints:

- Use semantic HTML5, CSS3, and vanilla JavaScript.
- Do not introduce React, Vue, Angular, or other frontend frameworks.
- Do not assume Jest, Vitest, or React-specific testing tools are available.
- Use native browser accessibility features whenever possible.
- Use automated accessibility tools that work with the project's actual technology stack.
- Follow the project's `AGENTS.md` and `docs/DESIGN_SYSTEM.md`.
- Preserve the approved Green 1.0 design tokens and verify actual color contrast.
- Do not change brand colors arbitrarily to fix contrast issues. Propose accessible alternatives within the design system when necessary.

## Resources

- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)
- [The A11y Project](https://www.a11yproject.com/)

## References

- [Semantic HTML and Structure](references/semantic-html.md) — Document landmarks, heading hierarchy, element selection, skip links
- [Focus Management](references/focus-management.md) — Focus indicators, focus not obscured, dialog focus traps, SPA route focus, focus-visible patterns
- [ARIA Patterns](references/aria-patterns.md) — Accessible tabs, live regions, data tables with ARIA attributes
- [Forms and Validation](references/forms-validation.md) — Label association, error announcement, redundant entry, accessible authentication
- [Color and Media](references/color-and-media.md) — Contrast requirements, reduced motion, dragging alternatives, video captions, alt text
- [Testing](references/testing.md) — Keyboard testing, screen reader pairings, axe DevTools, Lighthouse, and manual accessibility testing