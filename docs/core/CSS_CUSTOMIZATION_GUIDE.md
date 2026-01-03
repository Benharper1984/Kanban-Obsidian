# CSS Customization Guide

This guide explains how to customize the appearance of Vault Navigator views using CSS.

---

## Table of Contents

1. [CSS Variables](#css-variables)
2. [Common Selectors](#common-selectors)
3. [Theming](#theming)
4. [View Transitions](#view-transitions)
5. [Cross-View Highlighting](#cross-view-highlighting)
6. [Responsive Design](#responsive-design)
7. [Examples](#examples)

---

## CSS Variables

Vault Navigator Core provides CSS custom properties that all views should use for consistency.

### Spacing

```css
:root {
    --nav-spacing-xs: 4px;
    --nav-spacing-sm: 8px;
    --nav-spacing-md: 12px;
    --nav-spacing-lg: 16px;
    --nav-spacing-xl: 24px;
    --nav-spacing-2xl: 32px;
}
```

**Usage:**
```css
.my-element {
    padding: var(--nav-spacing-md);
    margin-bottom: var(--nav-spacing-lg);
    gap: var(--nav-spacing-sm);
}
```

### Border Radius

```css
:root {
    --nav-radius-xs: 2px;
    --nav-radius-sm: 4px;
    --nav-radius-md: 8px;
    --nav-radius-lg: 12px;
    --nav-radius-xl: 16px;
    --nav-radius-full: 9999px;
}
```

### Transitions

```css
:root {
    --nav-transition-fast: 150ms ease;
    --nav-transition-normal: 250ms ease;
    --nav-transition-slow: 350ms ease;
    --nav-transition-spring: 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Colors

Navigator uses Obsidian's color variables for theme compatibility:

```css
:root {
    /* Use Obsidian variables for colors */
    --nav-bg-primary: var(--background-primary);
    --nav-bg-secondary: var(--background-secondary);
    --nav-bg-hover: var(--background-modifier-hover);
    --nav-bg-active: var(--background-modifier-active-hover);
    
    --nav-border-color: var(--background-modifier-border);
    --nav-border-hover: var(--background-modifier-border-hover);
    
    --nav-text-normal: var(--text-normal);
    --nav-text-muted: var(--text-muted);
    --nav-text-faint: var(--text-faint);
    
    --nav-accent: var(--interactive-accent);
    --nav-accent-hover: var(--interactive-accent-hover);
}
```

### Shadows

```css
:root {
    --nav-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --nav-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
    --nav-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
    --nav-shadow-highlight: 0 0 0 2px var(--interactive-accent);
}
```

---

## Common Selectors

### View Container

```css
/* Base navigator view container */
.vault-navigator {
    height: 100%;
    overflow: hidden;
}

/* View-specific containers */
.navigator-kanban { }
.navigator-timeline { }
.navigator-map { }
.navigator-mindmap { }
```

### Items

```css
/* Generic item styling */
.nav-item {
    padding: var(--nav-spacing-md);
    border-radius: var(--nav-radius-md);
    cursor: pointer;
    transition: all var(--nav-transition-fast);
}

.nav-item:hover {
    background: var(--nav-bg-hover);
}

.nav-item-file { }
.nav-item-folder { }
.nav-item-link { }
```

### Toolbar

```css
.nav-toolbar {
    display: flex;
    align-items: center;
    gap: var(--nav-spacing-sm);
    padding: var(--nav-spacing-md);
    border-bottom: 1px solid var(--nav-border-color);
}

.nav-search {
    flex: 1;
    display: flex;
    align-items: center;
}

.nav-search-input {
    width: 100%;
    padding: var(--nav-spacing-sm) var(--nav-spacing-md);
    border: 1px solid var(--nav-border-color);
    border-radius: var(--nav-radius-md);
    background: var(--nav-bg-primary);
}
```

---

## Theming

### Light/Dark Mode

Obsidian handles theme switching automatically. Use CSS variables:

```css
/* Works in both light and dark mode */
.my-card {
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
}

/* Theme-specific overrides (avoid when possible) */
.theme-light .my-card {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.theme-dark .my-card {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
```

### Accent Color Support

Use Obsidian's accent color for interactive elements:

```css
.my-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.my-button:hover {
    background: var(--interactive-accent-hover);
}

/* For highlights using RGB values */
.my-highlight {
    background: rgba(var(--color-accent-rgb), 0.15);
    border-color: var(--interactive-accent);
}
```

---

## View Transitions

### Enter/Exit Animations

```css
/* View entering */
.navigator-view-enter {
    animation: nav-view-enter var(--nav-transition-normal);
}

/* View exiting */
.navigator-view-exit {
    animation: nav-view-exit var(--nav-transition-normal);
}

@keyframes nav-view-enter {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes nav-view-exit {
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(-10px);
    }
}
```

### Slide Transitions

```css
/* Slide from right */
.navigator-view-enter-right {
    animation: slide-in-right var(--nav-transition-normal);
}

@keyframes slide-in-right {
    from {
        opacity: 0;
        transform: translateX(20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* Slide from left */
.navigator-view-enter-left {
    animation: slide-in-left var(--nav-transition-normal);
}

@keyframes slide-in-left {
    from {
        opacity: 0;
        transform: translateX(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
```

---

## Cross-View Highlighting

When an item is focused in one view, all views should highlight it.

### Highlighted State

```css
/* Item highlighted from another view */
.nav-item-highlighted {
    border-color: var(--interactive-accent) !important;
    box-shadow: var(--nav-shadow-highlight),
                var(--nav-shadow-lg) !important;
    animation: highlight-pulse 1.5s ease-in-out;
}

@keyframes highlight-pulse {
    0%, 100% {
        box-shadow: var(--nav-shadow-highlight),
                    var(--nav-shadow-md);
    }
    50% {
        box-shadow: 0 0 0 4px var(--interactive-accent),
                    var(--nav-shadow-lg);
    }
}
```

### Selected State (Multi-select)

```css
/* Item selected in multi-select */
.nav-item-selected {
    background: rgba(var(--color-accent-rgb), 0.12) !important;
    border-color: var(--interactive-accent) !important;
}

.nav-item-selected::after {
    content: '✓';
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: var(--nav-radius-full);
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

### Focus Indicator (Keyboard Navigation)

```css
.nav-item:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile */
@media (max-width: 480px) {
    .nav-toolbar {
        flex-direction: column;
    }
    
    .nav-grid {
        grid-template-columns: 1fr;
    }
}

/* Tablet */
@media (min-width: 481px) and (max-width: 768px) {
    .nav-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* Desktop */
@media (min-width: 769px) {
    .nav-grid {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    }
}
```

### Container Queries (Modern Browsers)

```css
/* Adapt to container width */
.nav-view-container {
    container-type: inline-size;
}

@container (min-width: 600px) {
    .nav-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}
```

---

## Examples

### Custom Card Style

```css
/* Custom card with gradient accent */
.my-custom-card {
    position: relative;
    padding: var(--nav-spacing-lg);
    background: var(--background-primary);
    border-radius: var(--nav-radius-lg);
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
}

.my-custom-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(
        90deg,
        var(--interactive-accent),
        var(--color-purple)
    );
}

.my-custom-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--nav-shadow-lg);
}
```

### Tag Pills

```css
.nav-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    font-size: 0.75em;
    background: var(--background-modifier-hover);
    border-radius: var(--nav-radius-full);
    color: var(--text-muted);
    transition: all var(--nav-transition-fast);
}

.nav-tag:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

/* Tag colors by category */
.nav-tag[data-tag^="status/"] {
    background: rgba(var(--color-green-rgb), 0.2);
    color: var(--color-green);
}

.nav-tag[data-tag^="priority/"] {
    background: rgba(var(--color-red-rgb), 0.2);
    color: var(--color-red);
}
```

### Loading State

```css
.nav-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
}

.nav-loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
```

### Empty State

```css
.nav-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: var(--text-muted);
    text-align: center;
}

.nav-empty-icon {
    font-size: 3em;
    margin-bottom: var(--nav-spacing-md);
    opacity: 0.5;
}

.nav-empty-text {
    font-size: 1.1em;
    margin-bottom: var(--nav-spacing-sm);
}

.nav-empty-hint {
    font-size: 0.9em;
    opacity: 0.7;
}
```

---

## CSS Snippet for Users

Users can create a CSS snippet to customize Navigator views:

**File:** `.obsidian/snippets/vault-navigator-custom.css`

```css
/* Custom Navigator Styles */

/* Increase card padding */
.kanban-card,
.nav-item {
    padding: 16px;
}

/* Custom highlight color */
.nav-item-highlighted,
.kanban-card-highlighted {
    border-color: #ff6b6b !important;
    box-shadow: 0 0 0 2px #ff6b6b !important;
}

/* Rounded corners */
.kanban-list,
.nav-panel {
    border-radius: 16px;
}

/* Custom fonts */
.nav-item-title,
.kanban-card-title {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
}
```

---

## Best Practices

1. **Use CSS Variables** - Always use Navigator and Obsidian CSS variables for theme compatibility

2. **Avoid !important** - Use specific selectors instead of forcing styles with `!important`

3. **Test Both Themes** - Verify your styles work in both light and dark modes

4. **Use Transitions** - Add smooth transitions for hover and state changes

5. **Respect User Preferences** - Support `prefers-reduced-motion` for animations

```css
@media (prefers-reduced-motion: reduce) {
    .nav-item,
    .nav-item-highlighted {
        animation: none;
        transition: none;
    }
}
```

6. **Namespace Your Classes** - Use a unique prefix for your view's classes

```css
/* Good: namespaced */
.myview-card { }
.myview-header { }

/* Bad: generic */
.card { }
.header { }
```

---

## Resources

- [Obsidian CSS Variables](https://docs.obsidian.md/Reference/CSS+variables)
- [Lucide Icons](https://lucide.dev/icons/) (for icon names)
- [CSS Custom Properties Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
