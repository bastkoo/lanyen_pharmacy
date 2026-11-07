
---
title: ARIA Patterns
description: Accessible interface patterns using semantic HTML, keyboard navigation, ARIA live regions, and accessible data tables for Lan Yen Pharmacy
tags: [aria, tabs, live-regions, data-tables, keyboard-navigation]
---

# ARIA Patterns

## General ARIA Guidelines

- Prefer native HTML elements over custom ARIA implementations.
- Do not add ARIA roles when native HTML already provides the required semantics.
- Ensure every interactive element has an accessible name.
- Keep ARIA attributes synchronized with the actual interface state.
- Test keyboard navigation and screen reader announcements.
- Avoid unnecessary ARIA attributes that duplicate native HTML behavior.

## Accessible Tabs

Use the tab pattern only when the interface genuinely presents multiple related panels with one visible panel at a time.

### HTML Structure

```html
<div class="tabs">
    <div role="tablist" aria-label="Product information">
        <button
            type="button"
            role="tab"
            id="tab-description"
            aria-controls="panel-description"
            aria-selected="true"
            tabindex="0"
        >
            Description
        </button>

        <button
            type="button"
            role="tab"
            id="tab-usage"
            aria-controls="panel-usage"
            aria-selected="false"
            tabindex="-1"
        >
            Usage
        </button>

        <button
            type="button"
            role="tab"
            id="tab-storage"
            aria-controls="panel-storage"
            aria-selected="false"
            tabindex="-1"
        >
            Storage
        </button>
    </div>

    <div
        id="panel-description"
        role="tabpanel"
        aria-labelledby="tab-description"
        tabindex="0"
    >
        Product description content.
    </div>

    <div
        id="panel-usage"
        role="tabpanel"
        aria-labelledby="tab-usage"
        tabindex="0"
        hidden
    >
        Product usage instructions.
    </div>

    <div
        id="panel-storage"
        role="tabpanel"
        aria-labelledby="tab-storage"
        tabindex="0"
        hidden
    >
        Product storage instructions.
    </div>
</div>
```

### JavaScript Keyboard Interaction

```javascript
const tabList = document.querySelector('[role="tablist"]');

if (tabList) {
    const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));

    function activateTab(selectedTab, moveFocus = false) {
        tabs.forEach((tab) => {
            const isSelected = tab === selectedTab;

            tab.setAttribute('aria-selected', String(isSelected));
            tab.tabIndex = isSelected ? 0 : -1;

            const panelId = tab.getAttribute('aria-controls');
            const panel = document.getElementById(panelId);

            if (panel) {
                panel.hidden = !isSelected;
            }
        });

        if (moveFocus) {
            selectedTab.focus();
        }
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            activateTab(tab);
        });

        tab.addEventListener('keydown', (event) => {
            let nextIndex = index;

            switch (event.key) {
                case 'ArrowRight':
                    nextIndex = (index + 1) % tabs.length;
                    break;

                case 'ArrowLeft':
                    nextIndex = (index - 1 + tabs.length) % tabs.length;
                    break;

                case 'Home':
                    nextIndex = 0;
                    break;

                case 'End':
                    nextIndex = tabs.length - 1;
                    break;

                default:
                    return;
            }

            event.preventDefault();
            activateTab(tabs[nextIndex], true);
        });
    });
}
```

### Keyboard Requirements

- `Tab`: Move into the tab list and then to the active tab panel.
- `ArrowRight`: Move to the next tab.
- `ArrowLeft`: Move to the previous tab.
- `Home`: Move to the first tab.
- `End`: Move to the last tab.
- `Enter` and `Space`: Activate a tab when using manual activation.

This example uses automatic activation: selecting another tab with arrow keys also displays its panel.

Only the active tab should have `tabindex="0"`. Other tabs should have `tabindex="-1"`.

Keep the tab selection, visible panel, and keyboard focus synchronized.

## ARIA Live Regions

ARIA live regions announce dynamic content changes to screen reader users without requiring them to move focus.

### Polite Announcements

Use `aria-live="polite"` for non-urgent updates.

```html
<div id="cart-status" aria-live="polite" aria-atomic="true">
</div>
```

```javascript
const cartStatus = document.getElementById('cart-status');

function announceCartUpdate(message) {
    if (cartStatus) {
        cartStatus.textContent = message;
    }
}

announceCartUpdate('Product added to cart successfully.');
```

Suitable use cases:

- Product added to cart.
- Search results updated.
- Number of products in the cart changed.
- Background operations completed.

### Assertive Announcements

Use assertive announcements only for urgent information that requires immediate attention.

```html
<div id="urgent-error" role="alert"></div>
```

```javascript
const urgentError = document.getElementById('urgent-error');

function announceUrgentError(message) {
    if (urgentError) {
        urgentError.textContent = message;
    }
}
```

Suitable use cases:

- Important errors that prevent a critical operation.
- Urgent information requiring immediate user attention.

### Live Region Rules

- Prefer `polite` for ordinary status updates.
- Use `assertive` or `role="alert"` sparingly.
- Do not move keyboard focus just to announce an update.
- Use `aria-atomic="true"` when the complete message should be announced.
- Keep live regions in the document before updating their content.
- Avoid announcing the same information repeatedly.
- Do not use live regions for content that does not need an announcement.

## Accessible Data Tables

Use semantic HTML tables for genuinely tabular information, such as product inventories, order details, sales reports, and customer records.

### Basic Data Table

```html
<table>
    <caption>Monthly sales by region</caption>

    <thead>
        <tr>
            <th scope="col">Region</th>
            <th scope="col">Q1</th>
            <th scope="col">Q2</th>
        </tr>
    </thead>

    <tbody>
        <tr>
            <th scope="row">North</th>
            <td>$10,000</td>
            <td>$12,000</td>
        </tr>

        <tr>
            <th scope="row">South</th>
            <td>$8,000</td>
            <td>$9,500</td>
        </tr>
    </tbody>
</table>
```

### Pharmacy Inventory Table

```html
<table>
    <caption>Current pharmacy inventory</caption>

    <thead>
        <tr>
            <th scope="col">Product ID</th>
            <th scope="col">Product name</th>
            <th scope="col">Unit</th>
            <th scope="col">Stock quantity</th>
            <th scope="col">Expiry date</th>
        </tr>
    </thead>

    <tbody>
        <tr>
            <th scope="row">SP001</th>
            <td>Product A</td>
            <td>Box</td>
            <td>120</td>
            <td>2027-12-31</td>
        </tr>
    </tbody>
</table>
```

### Data Table Rules

- Use `<caption>` to provide a meaningful table description.
- Use `<th scope="col">` for column headers.
- Use `<th scope="row">` for row headers.
- Use `<td>` for ordinary data cells.
- Keep header relationships clear.
- Do not use tables solely for page layout.
- Ensure tables remain usable on smaller screens.
- Provide meaningful text for empty or unavailable data.
- Use more advanced header associations only when simple row and column headers are insufficient.

## Pharmacy Interface Guidelines

Apply these patterns only when they fit the actual interaction.

- Use tabs for related product information, such as description, usage, and storage.
- Use polite live announcements when a product is added to the cart.
- Announce important form submission errors using accessible error messages.
- Use semantic tables for inventory, orders, customer lists, and sales reports.
- Do not turn ordinary navigation links into tabs.
- Do not add ARIA attributes simply to make the markup appear more accessible.

Always follow the project's `AGENTS.md`, `docs/DESIGN_SYSTEM.md`, and approved frontend architecture.
