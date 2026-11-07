
---
title: Testing
description: Keyboard-only testing, screen reader testing with NVDA and VoiceOver, axe DevTools scanning, Lighthouse audits, and browser-based accessibility testing
tags: [testing, keyboard, screen-reader, voiceover, nvda, axe, lighthouse, manual-testing]
---

# Testing

## Keyboard-Only Testing

Test important pages without using a mouse.

1. Navigate through the page using `Tab`.
2. Navigate backward using `Shift + Tab`.
3. Activate buttons using `Enter` or `Space`.
4. Activate links using `Enter`.
5. Close dialogs and menus using `Escape` when supported.
6. Use arrow keys within components that implement arrow-key navigation, such as tabs and radio groups.
7. Verify that the focus order follows the logical reading and interaction order.
8. Ensure every interactive element has a visible focus indicator.
9. Verify that keyboard focus is never trapped unintentionally.

## Screen Reader Testing

### Recommended Screen Readers

| Priority | Screen Reader | Browser | Platform |
| --- | --- | --- | --- |
| 1 | NVDA | Chrome or Firefox | Windows (free) |
| 2 | VoiceOver | Safari | macOS / iOS (built-in) |
| 3 | TalkBack | Chrome | Android (built-in) |
| 4 | JAWS | Chrome or Edge | Windows (paid) |

### Basic Screen Reader Shortcuts

**NVDA (Windows):**

- `Ctrl + Alt + N`: Start NVDA when the default shortcut is configured.
- `Insert + Down`: Read continuously.
- `H` / `Shift + H`: Navigate headings.
- `D` / `Shift + D`: Navigate landmarks.
- `Tab`: Move between interactive elements.

**VoiceOver (macOS):**

- `Command + F5`: Toggle VoiceOver.
- `VO + Right Arrow`: Move to the next item.
- `VO + Left Arrow`: Move to the previous item.
- `VO + A`: Read the page.
- `VO` means `Control + Option`.

Shortcuts may vary depending on operating system settings and screen reader configuration.

### What to Verify

- Page titles and headings are announced correctly.
- Navigation landmarks are identifiable.
- Buttons and links have meaningful accessible names.
- Images have appropriate alternative text.
- Form labels are announced with their corresponding inputs.
- Validation errors are associated with the correct fields.
- Dialogs expose their accessible names and modal behavior.
- Dynamic updates are announced when necessary.
- Reading and navigation order are logical.

## Automated Accessibility Testing

Automated tools help identify common accessibility issues, but they cannot detect every violation.

### axe DevTools

Use the axe DevTools browser extension:

1. Open the page in Chrome or another supported browser.
2. Open Developer Tools using `F12`.
3. Select the axe DevTools panel.
4. Run an accessibility scan.
5. Review detected violations and their suggested fixes.

### Lighthouse

Use Lighthouse in Chrome DevTools:

1. Open the page in Chrome.
2. Open Developer Tools using `F12`.
3. Select Lighthouse.
4. Select the Accessibility category.
5. Generate the report.
6. Review the findings and address relevant issues.

A score of 90 or above can be used as an internal quality target, not as proof of WCAG compliance.

## Browser-Based Accessibility Testing

Use testing tools that work with the project's HTML, CSS, and vanilla JavaScript stack.

### Recommended Tools

- **axe DevTools:** Scan rendered pages for common accessibility violations.
- **Lighthouse:** Audit accessibility through Chrome DevTools.
- **Browser DevTools:** Inspect semantic HTML, accessible names, focus indicators, and color contrast.
- **Manual keyboard testing:** Verify that important interactions work without a mouse.
- **Screen readers:** Test how actual users receive page structure and interaction information.

### Testing Rules

- Do not introduce Jest, Vitest, React Testing Library, or React-specific testing dependencies.
- Do not assume a JavaScript unit testing framework is available.
- Test actual rendered pages rather than relying only on static source inspection.
- Supplement automated scans with manual keyboard and screen reader testing.
- Test important workflows, including authentication, product browsing, cart interactions, and order forms.
- Record actual violations and provide actionable fixes.
- Do not claim WCAG compliance based only on automated scores.

## Troubleshooting

### Focus indicators not visible

**Cause:** CSS reset removed outlines or the focus indicator has insufficient contrast.

**Fix:**

```css
:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
}
```

### Screen reader not announcing updates

**Cause:** Dynamic content is not exposed through an appropriate live region.

**Fix:**

```html
<div id="status-message" role="status" aria-live="polite">
</div>
```

Update the element's text content when an important status change occurs.

Use `role="alert"` for important errors that require immediate announcement. Avoid excessive announcements.

### Dialog focus escapes to background

**Cause:** A custom modal does not properly manage keyboard focus.

**Fix:**

- Prefer native `<dialog>` opened with `showModal()`.
- If using a custom modal, implement and test focus trapping.
- Support Escape when appropriate.
- Restore focus to the element that opened the dialog.

### Form errors not announced

**Cause:** Missing accessible error associations or invalid-state information.

**Fix:**

```html
<label for="email">Email</label>

<input
    type="email"
    id="email"
    aria-invalid="true"
    aria-describedby="email-error"
>

<p id="email-error" role="alert">
    Please enter a valid email address.
</p>
```

Ensure that the referenced error element exists and contains a meaningful message.

### Keyboard cannot reach interactive element

**Cause:** Using non-interactive HTML elements for clickable actions instead of native interactive elements.

**Fix:**

- Prefer `<button>` for actions and `<a href="...">` for navigation.
- Avoid using clickable `<div>` or `<span>` elements.
- If a custom interactive element is absolutely necessary, implement the appropriate ARIA role, keyboard interaction, focusability, and accessible name.
- Prefer native HTML elements whenever possible.

### Heading hierarchy broken

**Cause:** Headings are chosen for visual size instead of semantic level.

**Fix:**

- Use headings according to the logical content hierarchy.
- Avoid skipping heading levels unnecessarily.
- Use CSS classes to control visual appearance instead of choosing heading levels based on font size.
