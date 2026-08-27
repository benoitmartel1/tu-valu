# Trash Icon Absolute Positioning - Student & Skill Details

## Overview

Moved the trash (delete) icon to an absolute position in the top-right corner at 0.75rem from edges for both student and skill detail views.

## Changes Made

### 1. Template Updates

**Student Detail:**

- Removed `.detail-nav-bar` wrapper
- Moved trash button outside the normal flow
- Added `header-trash-btn--absolute` class
- Increased icon size to 36px (consistent with previous)

**Skill Detail:**

- Removed `.detail-nav-bar` wrapper with back button
- Moved trash button outside the normal flow
- Added `header-trash-btn--absolute` class
- Increased icon size from 24px to 36px (consistent with student detail)

### 2. CSS Updates

Added new modifier class:

```css
.header-trash-btn--absolute {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
}
```

### 3. Positioning Context

The parent container `.student-detail-column` already has:

```css
position: relative;
```

This provides the positioning context for the absolutely positioned trash button.

## Visual Result

**Before:**

- Trash button was in a navigation bar at the bottom of the detail view
- Part of the normal document flow
- Required scrolling to access in some cases

**After:**

- Trash button floats in top-right corner
- Always visible without scrolling
- Positioned exactly 0.75rem from top and right edges
- Consistent placement across student and skill details

## Benefits

1. **Always Visible** - No need to scroll to find delete action
2. **Consistent Location** - Same position for both student and skill details
3. **Space Efficient** - Doesn't take up vertical space in the layout
4. **Standard Pattern** - Follows common UI pattern for delete/close actions
5. **Clean Layout** - Removes unnecessary navigation bar wrapper

## Technical Details

**Positioning:**

- `position: absolute` - Removes from normal flow
- `top: 0.75rem` - 12px from top edge
- `right: 0.75rem` - 12px from right edge
- `z-index: 10` - Ensures it appears above other content

**Icon Size:**

- Both student and skill details now use 36px icon
- Provides good touch/click target size
- Visually prominent but not overwhelming

## Testing Checklist

- [ ] Open student detail - verify trash icon in top-right
- [ ] Open skill detail - verify trash icon in top-right
- [ ] Check spacing from edges (should be 0.75rem/12px)
- [ ] Verify icon is clickable
- [ ] Verify delete functionality still works
- [ ] Check that icon doesn't overlap with content
- [ ] Test on different screen sizes
- [ ] Verify z-index keeps it above other elements
