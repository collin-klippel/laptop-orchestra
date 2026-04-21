# Styling Architecture

This project uses a **hybrid styling approach** that combines global CSS and component-level CSS-in-JS. This document explains the strategy and conventions for maintaining consistent styling across the codebase.

## Overview

The styling architecture separates concerns between:

1. **Global CSS** (`client/src/index.css`) - Design system, theme variables, and global defaults
2. **CSS-in-JS** (component files) - Component-specific layout and interactive styles

## Global CSS Layer

The file `client/src/index.css` handles:

### CSS Variables (Design Tokens)
All components reference a set of CSS custom properties for theming:

- `--bg`: Primary background color
- `--bg-elev`: Elevated/secondary background (modals, panels)
- `--border`: Border and divider colors
- `--text`: Primary text color
- `--muted`: Secondary/muted text color
- `--accent`: Primary accent color for interactive elements
- `--accent-strong`: Darker variant of accent
- `--danger`: Error/destructive action color
- `--self`: Color for current user/self indicator
- `--font-display`: Display font family for headings
- `--title-ink`: Color for display titles
- `--title-glow`: Glow/shadow color for display titles

### Element Defaults
Global styling for native HTML elements (button, input, a) ensures consistent appearance across all components without requiring per-component overrides.

### Global Animations
CSS keyframes for reusable animations:

- `@keyframes sign-in-appear` - Entry animation for sign-in form
- `@keyframes marimba-sequence-playing-pulse` - Pulsing indicator for active sequences

### Global Classes
Utility classes applied via className for animations and special cases:

- `.sign-in-form` - Applied to the sign-in form for entrance animation
- `.sign-in-title` - Styled heading with glow effect
- `.marimba-sequence-playing-indicator` - Pulsing animation indicator

## CSS-in-JS Layer

Component files define inline style objects for component-specific styling. This approach provides:

### Benefits
- **Type safety**: Using `React.CSSProperties` prevents invalid CSS property names
- **Colocation**: Styles live alongside component logic for easier maintenance
- **Conditional styles**: Easy to apply different styles based on state/props
- **No class name collisions**: Styles are scoped to components automatically
- **Dynamic styles**: Can compute styles based on props (e.g., avatar background color)

### Pattern
Each component exports a single `styles` object containing all its styles:

```typescript
const styles: Record<string, React.CSSProperties> = {
  container: { /* ... */ },
  header: { /* ... */ },
  button: { /* ... */ },
  buttonActive: { /* ... */ },
};
```

Style names should be semantic and descriptive (e.g., `headerToggle`, `reconnectingContainer`) rather than structural (e.g., `div1`, `btn2`).

### Conditional Styles
Use the spread operator to apply conditional style overrides:

```typescript
<button
  style={{
    ...styles.button,
    ...(isActive ? styles.buttonActive : {}),
  }}
>
  Click me
</button>
```

### Dynamic Styles
For styles that depend on computed values, define style-generating functions:

```typescript
const styles = {
  avatar: (name: string): React.CSSProperties => ({
    background: `hsl(${hue(name)}, 70%, 30%)`,
  }),
};

// Usage:
<div style={styles.avatar(userName)} />
```

## Adding New Styles

### When to use global CSS
- Define a CSS variable if the value is reused across multiple components
- Add a CSS class if you need animations or special pseudo-element styling
- Add element defaults only if changing core HTML element behavior globally

### When to use CSS-in-JS
- Component-specific layout and positioning
- Conditional styling based on component state
- Dynamic styles computed from props
- Interactive states (hover, active, disabled)

## Theme Customization

To change colors across the entire app, edit the CSS variables in `client/src/index.css`:

```css
:root {
  --bg: #0a0e16;
  --accent: #22d3ee;
  /* ... etc ... */
}
```

All components will automatically reflect these changes since they reference variables via `var(--bg)`, `var(--accent)`, etc.

## Performance Considerations

- **CSS variables** are lightweight and cached by the browser
- **Inline styles** (CSS-in-JS) have zero startup cost and scale well with component count
- **No external dependencies** means smaller bundle size and faster load times
- Conditional style spreads are optimized by React and don't cause unnecessary re-renders

## Future Improvements

Potential enhancements to explore:

1. **Extract theme scale constants** - Move spacing, font sizes, and shadow definitions into a TypeScript constants file to reduce duplication and improve type safety
2. **Shared style utilities** - Create helper functions for common style patterns (flexbox layouts, typography, etc.)
3. **Responsive design utilities** - Add media query helpers if responsive breakpoints increase
4. **Dark mode support** - Consider extracting light/dark theme variants into separate CSS custom property sets

## References

- [CSS Custom Properties (Variables)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [React Inline Styles](https://react.dev/reference/react-dom/components/common#applying-css-styles)
- [Styling Patterns in React](https://react.dev/learn/styling)
