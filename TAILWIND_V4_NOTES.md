# Tailwind CSS v4 Important Notes

## Critical Compatibility Issues

### 1. @apply with Custom Colors
**NEVER** use `@apply` with custom color utilities in Tailwind v4. This will cause build errors.

❌ **Wrong:**
```css
.gradient-text {
  @apply bg-gradient-to-r from-vibrant-pink via-vibrant-purple to-vibrant-blue;
}
```

✅ **Correct:**
```css
.gradient-text {
  background: linear-gradient(to right, #FF006E, #8338EC, #3B82F6);
}
```

### 2. Custom Background Colors
**NEVER** use custom color names like `bg-dark-bg` with @apply.

❌ **Wrong:**
```css
body {
  @apply bg-dark-bg text-white;
}
```

✅ **Correct:**
```css
body {
  background-color: #0A0A0B;
  color: #FFFFFF;
}
```

### 3. Complex Utility Classes
When using complex utilities with custom values, write them as standard CSS properties.

❌ **Wrong:**
```css
.btn {
  @apply px-8 py-4 bg-gradient-neon;
}
```

✅ **Correct:**
```css
.btn {
  padding: 16px 32px;
  background: linear-gradient(135deg, #FF006E, #8338EC, #3B82F6);
}
```

## Safe @apply Usage

You CAN safely use @apply with:
- Standard Tailwind utilities (relative, absolute, flex, etc.)
- Standard spacing utilities (p-4, m-2, etc.)
- Standard border utilities (rounded-full, border, etc.)
- Built-in Tailwind colors (text-white, bg-black, etc.)

## Best Practices for Tailwind v4

1. Use inline classes in HTML for standard utilities
2. Create custom CSS classes for complex styles
3. Use CSS variables for repeated custom values
4. Avoid @apply for anything involving custom theme values