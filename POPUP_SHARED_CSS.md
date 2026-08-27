# Popup Components - Shared CSS Structure

## Overview

All popup components now share common styling through the base `Popup.vue` wrapper component, while each child component only includes its specific content styles.

## CSS Architecture

### Shared Styles (in `Popup.vue`)

These styles are defined once and reused by all popups:

```css
/* Backdrop overlay */
.popup-backdrop {
  position: absolute;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(10, 20, 30, 0.72);
}

/* Modal container */
.popup-modal {
  box-sizing: border-box;
  width: 80%;
  height: auto;
  max-height: v-bind(maxHeight);
  max-width: v-bind(maxWidth);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 1.4rem;
  border-radius: 16px;
  background: #ffffff;
  color: #333;
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.35);
}

/* Header with title and close button */
.popup-header { ... }
.popup-close { ... }

/* Content area */
.popup-content {
  flex: 1;
  overflow-y: auto;
}
```

### Component-Specific Styles

#### `IconSelector.vue`

Only includes styles for:

- `.icon-selector` - Layout container
- `.icon-selector-search` - Search input wrapper
- `.icon-selector-input` - Search field styling
- `.icon-selector-grid` - Icon grid layout
- `.icon-selector-option` - Individual icon buttons
- `.icon-selector-img` - Icon images

#### `Settings.vue`

Only includes styles for:

- `.settings-content` - Main layout
- `.settings-section` - Filter sections
- `.settings-section-title` - Section headers
- `.settings-options` - Option grids
- `.settings-option` - Radio button options
- `.toggle-teams-btn` - Team toggle button

## Benefits

### 1. **Consistency**

All popups have:

- Same backdrop appearance
- Same modal sizing (80% width, configurable max)
- Same header style
- Same close button
- Same shadow and border radius

### 2. **Maintainability**

- Change modal size? Update `Popup.vue` only
- Change backdrop color? Update `Popup.vue` only
- Add animation? Update `Popup.vue` only
- All popups update automatically

### 3. **No Duplication**

- Backdrop CSS: Defined once in `Popup.vue`
- Modal container CSS: Defined once in `Popup.vue`
- Header CSS: Defined once in `Popup.vue`
- Each component only has its unique content styles

### 4. **Flexibility**

Child components can still customize:

- Pass different `maxWidth` and `maxHeight` props
- Add their own content-specific styles
- Override specific styles if needed

## File Structure

```
popup/
├── Popup.vue          # Shared styles (backdrop, modal, header)
├── IconSelector.vue   # Only icon-specific styles
└── Settings.vue       # Only settings-specific styles
```

## Usage Example

```vue
<!-- All popups use the same base structure -->
<Popup title="My Modal" max-width="800px" max-height="70%">
  <!-- Your custom content here -->
  <div class="my-custom-content">
    <!-- Component-specific styles only -->
  </div>
</Popup>
```

## Styling Guidelines

### DO:

- ✅ Put backdrop/modal/header styles in `Popup.vue`
- ✅ Put content-specific styles in child components
- ✅ Use scoped styles in child components
- ✅ Pass size props to customize modal dimensions

### DON'T:

- ❌ Duplicate backdrop styles in child components
- ❌ Duplicate modal container styles
- ❌ Duplicate header/close button styles
- ❌ Use unscoped styles that might leak

## Future Enhancements

With this structure, we can easily:

1. Add transitions/animations to `Popup.vue` → affects all popups
2. Add dark mode support in `Popup.vue` → affects all popups
3. Add size presets (small, medium, large) as props
4. Add different header styles as variants
5. Add keyboard shortcuts (ESC to close) in one place

## Testing Checklist

- [ ] Icon selector modal displays correctly
- [ ] Settings modal displays correctly
- [ ] Both have same backdrop style
- [ ] Both have same modal container style
- [ ] Both have same header style
- [ ] Close button works in both
- [ ] Backdrop click closes both
- [ ] Content scrolls properly in both
- [ ] No duplicate CSS in bundle
