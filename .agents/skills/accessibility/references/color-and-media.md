
---
title: Color and Media
description: WCAG 2.2 AA color contrast, accessible image alternatives, media captions, reduced motion, and pointer interaction alternatives
tags: [color, contrast, alt-text, images, video, captions, media, reduced-motion]
---

# Color and Media

## Color and Contrast

Follow WCAG 2.2 Level AA color contrast requirements.

### Contrast Requirements

| Content | Minimum contrast ratio |
|---|---|
| Normal text | 4.5:1 |
| Large text | 3:1 |
| UI components and meaningful graphical objects | 3:1 |

Large text means at least 18pt (24px) regular or 14pt (approximately 18.67px) bold.

### CSS Examples

```css
/* WRONG: insufficient contrast on a white background */
:root {
    --text-muted: #999999;
}

/* BETTER: stronger contrast on a white background */
:root {
    --text: #595959;
}
```

Do not assume that a color combination is accessible based on appearance alone. Verify actual foreground and background combinations with a contrast checker.

### Lan Yen Pharmacy Design System

Use the approved Green 1.0 design tokens:

- Primary: `#16865B`
- Primary Dark: `#106B48`
- Primary Light: `#E8F5EE`
- White: `#FFFFFF`
- Background: `#F5F7F6`
- Text: `#333333`
- Text Muted: `#777777`
- Border: `#E5E7EB`
- Success: `#28A745`
- Warning: `#FFC107`
- Danger: `#DC3545`
- Info: `#17A2B8`

Important rules:

- Verify contrast for every actual text and background combination.
- Do not assume all approved color combinations automatically meet WCAG requirements.
- Do not change brand colors arbitrarily to solve contrast issues.
- Propose accessible combinations using the existing design system where possible.
- Do not use low-contrast text for important information.

### Never Use Color Alone

Never use color as the only way to communicate information.

```html
<!-- WRONG: color alone -->
<span class="status-error">Error</span>

<!-- CORRECT: text communicates the status -->
<span class="status-error">
    <span aria-hidden="true">!</span>
    Payment failed
</span>
```

Apply this principle to:

- Order statuses.
- Payment statuses.
- Inventory warnings.
- Form validation messages.
- Product availability.
- Success and error notifications.

Use meaningful text labels or icons alongside color indicators.

Decorative icons should be hidden from assistive technology using `aria-hidden="true"` when adjacent text already communicates their meaning.

## Text Alternatives

Provide appropriate text alternatives for images based on their purpose.

### Informative Images

Describe the meaningful information conveyed by the image.

```html
<img
    src="/assets/images/product-example.jpg"
    alt="Product A packaging, 500 mg, box of 20 tablets"
>
```

### Decorative Images

Use an empty `alt` attribute for images that provide no meaningful information.

```html
<img src="/assets/images/decorative-border.png" alt="">
```

### Functional Images

When an image is the only content of a link or button, its alternative text must describe the action or destination.

```html
<a href="/cart" aria-label="View shopping cart">
    <img src="/assets/icons/cart.svg" alt="">
</a>
```

### Icon Buttons

Provide an accessible name for buttons containing only icons.

```html
<button type="button" aria-label="Close dialog">
    <svg aria-hidden="true" viewBox="0 0 24 24">
        <!-- Decorative icon paths -->
    </svg>
</button>
```

### Complex Images

For charts, diagrams, and images containing substantial information:

- Provide a concise alternative text.
- Include a nearby detailed explanation when necessary.
- Use `<figure>` and `<figcaption>` to associate an image with its description.
- Use `<details>` when users need access to a longer optional explanation.

Example:

```html
<figure>
    <img
        src="/assets/images/sales-chart.png"
        alt="Monthly sales chart showing an increase during the final quarter"
    >

    <figcaption>
        Monthly sales performance.
        <details>
            <summary>View detailed chart description</summary>
            <p>
                Sales increased throughout the final quarter,
                reaching the highest value in December.
            </p>
        </details>
    </figcaption>
</figure>
```

### Image Guidelines for Pharmacy Products

- Use meaningful alternative text for informative product images.
- Describe visible product information without inventing medical claims.
- Do not repeat the entire product description in the image's `alt` attribute.
- Use empty alternative text for purely decorative images.
- Do not use filenames as alternative text.
- Do not leave informative images without an appropriate text alternative.

## Video and Audio

Provide accessible controls and alternatives for multimedia content.

### Video with Captions

```html
<video controls preload="metadata">
    <source src="/assets/media/product-guide.mp4" type="video/mp4">

    <track
        kind="captions"
        src="/assets/media/captions-vi.vtt"
        srclang="vi"
        label="Tiếng Việt"
        default
    >

    Your browser does not support HTML video.
</video>
```

### Audio Content

Provide a text transcript for meaningful audio content.

```html
<audio controls preload="metadata">
    <source src="/assets/media/audio-guide.mp3" type="audio/mpeg">
    Your browser does not support HTML audio.
</audio>

<p>
    <a href="/assets/media/audio-guide-transcript.html">
        Read audio transcript
    </a>
</p>
```

### Media Rules

- Require user interaction to start audio or video.
- Do not autoplay media with sound.
- Provide captions for prerecorded video containing meaningful audio.
- Provide transcripts for meaningful audio content.
- Ensure media controls are keyboard accessible.
- Use clear labels for playback controls.
- Provide audio descriptions or equivalent alternatives when important visual information is not conveyed through the existing audio.
- Do not rely on captions alone to describe important visual-only information.

## Reduced Motion

Respect the user's system motion preferences.

Animations that are purely decorative should be reduced or disabled when `prefers-reduced-motion: reduce` is active.

Essential information and functionality must remain available.

```css
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}
```

Additional rules:

- Avoid unnecessary flashing and rapid visual effects.
- Do not use animation as the only way to communicate important information.
- Preserve essential feedback and state changes.
- Avoid automatically moving or continuously updating content without appropriate user controls.
- Test important interactions with reduced motion enabled.

## Dragging Alternatives (WCAG 2.5.7)

Any functionality that uses dragging must also provide a single-pointer alternative that does not require dragging, unless a WCAG exception applies.

Examples:

- Drag-and-drop reordering should provide Move Up and Move Down buttons.
- Carousels should provide Previous and Next buttons.
- Custom sliders should provide an alternative way to enter or select a value.
- Interactive maps should provide controls for important operations that do not require dragging.

### Example: Reordering Items

```html
<ul>
    <li>
        <span>Item 1</span>

        <button type="button" aria-label="Move Item 1 up">
            Move up
        </button>

        <button type="button" aria-label="Move Item 1 down">
            Move down
        </button>
    </li>
</ul>
```

### Dragging Rules

- Do not make dragging the only way to complete an operation.
- Provide visible alternative controls.
- Ensure alternative controls are keyboard accessible.
- Give controls meaningful accessible names.
- Make the alternatives available without requiring users to perform a dragging gesture.

## Accessibility Verification

Before considering colors and media accessible:

- Check text contrast against its actual background.
- Check meaningful icons and UI component contrast.
- Verify that status information is not communicated through color alone.
- Inspect informative images for meaningful alternative text.
- Verify decorative images use empty `alt` attributes.
- Test captions and transcripts.
- Test media controls using a keyboard.
- Enable reduced motion and inspect important interactions.
- Verify that dragging operations have appropriate alternatives.

Use browser DevTools, Lighthouse, axe DevTools, and manual testing.

Do not claim WCAG compliance based only on automated scan results.
