
---
title: Focus Management
description: Accessible focus indicators, keyboard navigation, native dialog behavior, focus restoration, and page navigation focus management
tags: [focus, focus-visible, focus-trap, dialog, keyboard-navigation, spa-navigation]
---

# Focus Management

## Focus Indicators

Every interactive element must have a visible keyboard focus indicator.

Never remove focus outlines without providing an accessible replacement.

```css
/* WRONG: removes the focus indicator */
button:focus {
    outline: none;
}

/* CORRECT: provides a visible focus indicator */
:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
}
```

### Focus Indicator Rules

- Never remove focus indicators without providing an accessible alternative.
- Use `:focus-visible` to provide visible indicators for keyboard navigation.
- Ensure focus indicators have sufficient contrast against adjacent colors.
- Do not rely on color alone when the focus state needs additional visual distinction.
- Check focus indicators on buttons, links, inputs, selects, and custom interactive components.

A contrast ratio of at least 3:1 is generally required for visual information identifying UI component states under WCAG 1.4.11.

## Focus Appearance (WCAG 2.4.13)

Focus Appearance is a WCAG 2.2 Level AAA criterion, not Level AA.

Use its stronger focus-indicator requirements as an additional quality target where practical.

The criterion includes:

- Indicator area at least equivalent to a 2 CSS pixel thick perimeter of the unfocused component.
- Contrast ratio of at least 3:1 between the same pixels in focused and unfocused states.
- Focus indicators must not be obscured by author-created content.

Example:

```css
button:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
}

a:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 3px;
}
```

Do not claim that a 2px outline automatically satisfies WCAG 2.4.13. Its actual area, contrast, and visual presentation must be evaluated.

## Focus Not Obscured (WCAG 2.4.11)

When an element receives keyboard focus, it must not be entirely hidden by author-created content.

Common problems include:

- Sticky navigation bars.
- Fixed headers and footers.
- Cookie consent banners.
- Floating chat widgets.
- Fixed bottom navigation.

Use scroll margins to help keep focused elements visible.

```css
html {
    scroll-padding-top: 80px;
    scroll-padding-bottom: 48px;
}

:target {
    scroll-margin-top: 80px;
}

:focus {
    scroll-margin-top: 80px;
    scroll-margin-bottom: 48px;
}
```

### Focus Visibility Rules

- Account for sticky headers and fixed navigation.
- Ensure focused controls remain visible when the page scrolls.
- Do not allow floating widgets to permanently cover interactive elements.
- Test keyboard navigation at different viewport sizes.
- Verify that dialogs and overlays do not obscure important focus indicators.

Scroll margins help with visibility but do not replace actual testing.

## Dialog Focus Management

Prefer the native HTML `<dialog>` element when implementing modal dialogs.

It provides built-in modal behavior, including focus handling and Escape-key support when opened with `showModal()`.

### HTML Structure

```html
<button type="button" id="open-dialog">
    Open dialog
</button>

<dialog id="confirm-dialog" aria-labelledby="dialog-title">
    <h2 id="dialog-title">Confirm action</h2>

    <p>Are you sure you want to continue?</p>

    <button type="button" id="cancel-dialog">
        Cancel
    </button>

    <button type="button" id="confirm-action">
        Confirm
    </button>
</dialog>
```

### JavaScript Interaction

```javascript
const dialog = document.getElementById('confirm-dialog');
const openButton = document.getElementById('open-dialog');
const cancelButton = document.getElementById('cancel-dialog');
const confirmButton = document.getElementById('confirm-action');

let previousFocus = null;

if (dialog && openButton && cancelButton && confirmButton) {
    openButton.addEventListener('click', () => {
        previousFocus = document.activeElement;
        dialog.showModal();
        cancelButton.focus();
    });

    cancelButton.addEventListener('click', () => {
        dialog.close('cancel');
    });

    confirmButton.addEventListener('click', () => {
        dialog.close('confirm');
    });

    dialog.addEventListener('close', () => {
        if (previousFocus && typeof previousFocus.focus === 'function') {
            previousFocus.focus();
        }
    });
}
```

### Dialog Rules

- Prefer native `<dialog>` for modal dialogs.
- Open modal dialogs using `showModal()`.
- Give every dialog an accessible name using `aria-labelledby` or `aria-label`.
- Move focus to an appropriate element when opening the dialog.
- Keep keyboard focus within the modal while it is open.
- Support Escape to close the dialog when appropriate.
- Restore focus to the element that opened the dialog after closing.
- Ensure all dialog actions are keyboard accessible.
- Do not use `aria-modal="true"` on a dialog that does not actually behave as modal.

When using a custom dialog instead of native `<dialog>`, implement and test focus trapping, background interaction prevention, Escape handling, and focus restoration.

## SPA Focus Management

Single-page applications do not automatically move keyboard focus when the visible page changes.

When implementing client-side navigation:

- Update the document title.
- Move focus to the main content or page heading after navigation.
- Provide a meaningful focus target with `tabindex="-1"` when necessary.
- Announce important route changes to screen reader users.
- Avoid moving focus during unrelated background updates.
- Preserve normal keyboard navigation behavior.

### HTML Structure

```html
<header>
    <nav aria-label="Main navigation">
        <a href="/products" data-link>Products</a>
        <a href="/orders" data-link>Orders</a>
    </nav>
</header>

<main id="main-content" tabindex="-1">
    <h1 id="page-title">Products</h1>
    <div id="page-content"></div>
</main>

<div
    id="route-announcement"
    class="visually-hidden"
    role="status"
    aria-live="polite"
    aria-atomic="true"
></div>
```

### JavaScript Focus Management Example

```javascript
function handlePageNavigation(pageTitle) {
    const mainContent = document.getElementById('main-content');
    const announcement = document.getElementById('route-announcement');

    if (!mainContent || !announcement) {
        return;
    }

    document.title = `${pageTitle} | Lan Yen Pharmacy`;

    mainContent.focus();

    announcement.textContent = `Navigated to ${pageTitle}`;
}
```

This function should be called after the new page content has been rendered.

### SPA Navigation Rules

- Do not move focus before the new content is ready.
- Use meaningful page titles.
- Focus the main content or an appropriate page heading.
- Announce route changes without repeatedly announcing unrelated updates.
- Avoid unnecessary focus movement.
- Ensure the focused element has a visible focus indicator.

For traditional multi-page navigation, the browser normally handles document focus. Do not add unnecessary custom focus management.

## Visually Hidden Content

Use a visually hidden utility class for screen-reader-only announcements and supplementary text.

```css
.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
```

Do not use `display: none` or `visibility: hidden` for content that must remain available to screen readers.

## Focus Management Verification

Before considering focus management complete:

- Navigate the entire page using only the keyboard.
- Verify visible focus indicators on interactive elements.
- Check that focus is not obscured by sticky or fixed elements.
- Open and close dialogs using keyboard controls.
- Verify focus restoration after closing dialogs.
- Test SPA navigation and route announcements where applicable.
- Check focus behavior at different viewport sizes.
- Verify that focus is never moved unexpectedly during ordinary interactions.

Use browser DevTools, keyboard-only testing, and NVDA with Chrome or Firefox.

Do not claim accessibility compliance without sufficient manual testing.
