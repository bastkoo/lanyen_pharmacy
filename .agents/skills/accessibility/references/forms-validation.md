
---
title: Forms and Validation
description: Accessible form patterns using semantic HTML, label association, validation messages, and browser-based accessibility practices
tags: [forms, validation, labels, aria-invalid, error-handling, screen-reader]
---

# Forms and Validation

## Accessible Form Input

Use semantic HTML and associate every form control with a visible label.

```html
<div class="form-group">
    <label for="email">Email address *</label>

    <input
        type="email"
        id="email"
        name="email"
        autocomplete="email"
        required
        aria-invalid="true"
        aria-describedby="email-error"
    >

    <p id="email-error" class="form-error" role="alert">
        Please enter a valid email address.
    </p>
</div>
```

When there is no validation error, omit `aria-invalid` or set it to `false`. Only reference an error element through `aria-describedby` when that element exists.

## Form Rules

- Every input needs an associated visible `<label>`. Placeholders are not labels.
- Use `aria-invalid="true"` when a field contains invalid data.
- Use `aria-describedby` to associate hints and error messages with their inputs.
- Use `role="alert"` for important errors that need immediate announcement. Avoid excessive announcements.
- Use the native `required` attribute for mandatory fields.
- Provide clear instructions before complex forms.
- Identify errors in text, not just through color.
- Preserve user-entered values when validation fails.
- Use appropriate input types and `autocomplete` attributes.

## Redundant Entry (WCAG 3.3.7)

Do not require users to re-enter information they have already provided in the same process.

- Reuse previously entered information when appropriate.
- Allow users to select previously saved addresses.
- Provide an option to reuse billing information as shipping information.
- Preserve entered data when users navigate between form steps.

Example:

```html
<fieldset>
    <legend>Shipping Address</legend>

    <label>
        <input type="checkbox" id="same-address" checked>
        Same as billing address
    </label>

    <div id="shipping-address" hidden>
        <label for="shipping-street">Street address</label>
        <input type="text" id="shipping-street" name="shipping_street">
    </div>
</fieldset>

<script>
    const checkbox = document.getElementById('same-address');
    const address = document.getElementById('shipping-address');

    checkbox.addEventListener('change', () => {
        address.hidden = checkbox.checked;
    });
</script>
```

When hiding form sections, ensure hidden inputs cannot receive focus or be submitted unintentionally. Preserve user-entered values when appropriate.

## Consistent Help (WCAG 3.2.6)

If a website provides help mechanisms (human contact details, automated chat, self-help links, FAQ), those mechanisms must appear in the same relative order on each page. The help does not need to be on every page, but when present, it must be consistently placed.

```html
<!-- Footer help section: same order on every page -->
<footer>
    <nav aria-label="Help">
        <a href="/faq">FAQ</a>
        <a href="/contact">Contact Us</a>
        <a href="/chat">Live Chat</a>
    </nav>
</footer>
```

## Accessible Authentication (WCAG 3.3.8)

Authentication must not unnecessarily require users to solve, remember, or transcribe information that creates a cognitive barrier.

- Allow password managers and browser autofill.
- Never block copy and paste in password fields.
- Use appropriate `autocomplete` attributes.
- Provide clear labels and accessible error messages.
- Offer an accessible alternative when authentication uses CAPTCHA or other cognitive function tests.

Example:

```html
<label for="password">Password</label>
<input
    type="password"
    id="password"
    name="password"
    autocomplete="current-password"
    required
>
```

Do not use `autocomplete="off"` on password fields without a specific, justified reason.
