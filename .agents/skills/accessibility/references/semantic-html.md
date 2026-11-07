---
title: Semantic HTML and Structure
description: Document landmarks, heading hierarchy, element selection for interactive and grouping elements, and skip link implementation
tags: [semantic-html, landmarks, headings, skip-links, document-structure]
---

# Semantic HTML and Structure

Use the right element. Semantic elements provide built-in keyboard support and screen reader announcements.

## Language and Document Metadata

- Set the document language to Vietnamese using `<html lang="vi">` for Vietnamese pages.
- Use an appropriate UTF-8 charset declaration.
- Provide a descriptive page title for every page.
- Use meaningful metadata where relevant.

## Semantic vs Non-Semantic

```html
<!-- WRONG: divs with onClick -->
<div onclick="submit()">Submit</div>
<div onclick="navigate()">Next page</div>

<!-- CORRECT: semantic elements -->
<button type="submit">Submit</button>
<a href="/next">Next page</a>
```

## Document Structure and Landmarks

```html
<header>
  <nav aria-label="Main navigation">...</nav>
</header>

<main id="main-content">
  <h1>Page Title</h1>
  <h2>Section 1</h2>
  <h3>Subsection 1.1</h3>
  <h2>Section 2</h2>

  <article>...</article>
  <aside>...</aside>
</main>

<footer>...</footer>
```

Heading hierarchy should reflect the logical structure of the content.

- Use one clear primary `<h1>` for the main page heading in normal page layouts.
- Nest headings logically (`h1` → `h2` → `h3`) without skipping levels.
- Do not choose heading levels merely to achieve a visual font size; use CSS for styling.

## ARIA: Only When HTML Cannot Express the Pattern

```html
<!-- WRONG: unnecessary ARIA -->
<button role="button">Click me</button>

<!-- CORRECT: ARIA fills a semantic gap -->
<div role="dialog" aria-labelledby="title" aria-modal="true">
  <h2 id="title">Confirm action</h2>
</div>

<!-- BETTER: native HTML when available -->
<dialog aria-labelledby="title">
  <h2 id="title">Confirm action</h2>
</dialog>
```

## Skip Links

```html
<a href="#main-content" class="skip-link">Skip to main content</a>

<nav>...</nav>

<main id="main-content" tabindex="-1">...</main>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--primary);
  color: white;
  padding: 8px 16px;
  z-index: 9999;
}

.skip-link:focus {
  top: 0;
}
```
## Pharmacy Website Guidelines

- Use `<article>` for self-contained content such as individual pharmacy articles or news posts.
- Use `<section>` for logically grouped content with an appropriate heading.
- Use `<nav>` for major navigation areas.
- Use `<main>` for the primary content of each page.
- Use `<button>` for actions such as adding products to a cart or submitting forms.
- Use `<a>` for navigation to product details, categories, and other pages.
- Use `<table>` for genuinely tabular data, such as order details or inventory reports.
- Do not use semantic elements solely for their default visual appearance.