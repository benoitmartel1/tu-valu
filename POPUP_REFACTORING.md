# Popup Components Refactoring

## Overview

Refactored popup overlays into reusable components with shared styling for better maintainability and consistency.

## Directory Structure

```
src/components/
├── popup/                    # Reusable popup components
│   ├── Popup.vue            # Base popup wrapper (shared styling)
│   ├── IconSelector.vue     # Skill icon selector
│   └── Settings.vue         # Filter/settings modal (renamed from filter)
├── auth/                     # Authentication components
│   ├── AuthGuard.vue
│   ├── AuthModal.vue
│   └── ResetPassword.vue
├── LiveSession.vue          # Main component (updated imports)
└── ...other components
```

## Created Components

### 1. `popup/Popup.vue` - Base Wrapper

**Purpose:** Reusable modal wrapper with consistent styling

**Props:**

- `title` (String, required) - Modal title
- `maxWidth` (String, default: "900px") - Maximum width
- `maxHeight` (String, default: "80%") - Maximum height

**Events:**

- `@close` - Emitted when close button or backdrop is clicked

**Features:**

- Consistent backdrop styling
- White modal container with rounded corners
- Header with title and close button
- Scrollable content area
- Z-index: 9999

**Usage:**

```vue
<Popup title="My Modal" @close="show = false">
  <div>Your content here</div>
</Popup>
```

### 2. `popup/IconSelector.vue` - Icon Picker

**Purpose:** Select skill icons from a grid

**Props:**

- `show` (Boolean) - Whether to show modal
- `icons` (Array) - List of icon names
- `selectedIcon` (String) - Currently selected icon
- `search` (String) - Search query

**Events:**

- `@close` - Close modal
- `@select` - Icon selected (payload: iconName)
- `@update:search` - Search input changed

**Features:**

- Uses Popup wrapper
- Search input
- Responsive grid of icons
- Hover and selected states

**Usage:**

```vue
<IconSelector
  :show="showIconPicker"
  :icons="filteredSkillIcons"
  :selected-icon="skillDetailEditing?.icon"
  :search="iconPickerSearch"
  @close="showIconPicker = false"
  @select="selectSkillIcon"
  @update:search="iconPickerSearch = $event"
/>
```

### 3. `popup/Settings.vue` - Settings/Filter Modal

**Purpose:** Configure sorting, gender filter, and team settings

**Props:**

- `show` (Boolean) - Whether to show modal
- `sortBy` (String) - Current sort option
- `genderFilter` (String) - Current gender filter
- `teamsActive` (Boolean) - Whether teams are active
- `activeTeamId` (String|null) - Selected team ID
- `teams` (Array) - List of teams

**Events:**

- `@close` - Close modal
- `@update:sortBy` - Sort option changed
- `@update:genderFilter` - Gender filter changed
- `@update:teamsActive` - Teams toggle changed
- `@update:activeTeamId` - Team selection changed

**Features:**

- Uses Popup wrapper
- Three sections: Sort, Gender, Teams
- Radio button options
- Team color coding
- Toggle button for teams

**Usage:**

```vue
<Settings
  :show="showFilterModal"
  :sort-by="sortBy"
  :gender-filter="genderFilter"
  :teams-active="teamsActive"
  :active-team-id="activeTeamId"
  :teams="teams"
  @close="showFilterModal = false"
  @update:sort-by="sortBy = $event"
  @update:gender-filter="genderFilter = $event"
  @update:teams-active="teamsActive = $event"
  @update:active-team-id="activeTeamId = $event"
/>
```

## Benefits

### 1. **Shared Styling**

- All popups use the same `Popup.vue` wrapper
- Consistent sizing, colors, and animations
- Easy to update all popups by changing one file

### 2. **Reusability**

- Components can be used anywhere in the app
- No code duplication
- Easy to add new popups

### 3. **Maintainability**

- Clear separation of concerns
- Each popup is a self-contained component
- Easier to test and debug

### 4. **Extensibility**

- Easy to add new popup types
- Can extend Popup base with new features
- Consistent API across all popups

## Migration Steps for LiveSession.vue

### Step 1: Replace Icon Picker Modal

**Find:** The inline icon picker modal (~line 3964)
**Replace with:**

```vue
<IconSelector
  :show="showSkillIconPicker"
  :icons="filteredSkillIcons"
  :selected-icon="skillDetailEditing?.icon"
  :search="iconPickerSearch"
  @close="showSkillIconPicker = false"
  @select="selectSkillIcon"
  @update:search="iconPickerSearch = $event"
/>
```

### Step 2: Replace Filter Modal

**Find:** The filter modal (~line 3850)
**Replace with:**

```vue
<Settings
  :show="showFilterModal"
  :sort-by="sortBy"
  :gender-filter="genderFilter"
  :teams-active="teamsActive"
  :active-team-id="activeTeamId"
  :teams="teams"
  @close="showFilterModal = false"
  @update:sort-by="sortBy = $event"
  @update:gender-filter="genderFilter = $event"
  @update:teams-active="teamsActive = $event"
  @update:active-team-id="activeTeamId = $event"
/>
```

### Step 3: Remove Old CSS

Remove the following CSS classes from LiveSession.vue:

- `.icon-picker-modal-backdrop`
- `.icon-picker-modal`
- `.icon-picker-modal-header`
- `.icon-picker-modal-close`
- `.icon-picker-modal-search`
- `.icon-picker-modal-input`
- `.icon-picker-modal-grid`
- `.icon-picker-modal-option`
- `.icon-picker-modal-img`
- `.filter-modal-backdrop`
- `.filter-modal`
- `.filter-modal-header`
- `.filter-modal-close`
- `.filter-modal-content`
- `.filter-modal-section`
- `.filter-modal-section-header`
- `.filter-modal-section-title`
- `.filter-modal-options`
- `.filter-modal-option`

These are now in the component files.

## Future Enhancements

With this structure, we can easily:

1. Add new popup types (e.g., ConfirmDialog, DatePicker)
2. Add animations/transitions to Popup wrapper
3. Add keyboard shortcuts (ESC to close)
4. Add focus trapping for accessibility
5. Add size variants (small, medium, large)
6. Add different themes (dark mode support)

## Testing Checklist

- [ ] Icon selector opens and closes correctly
- [ ] Icon selection works
- [ ] Search in icon selector works
- [ ] Settings modal opens and closes
- [ ] All filter options work (sort, gender, teams)
- [ ] Team colors display correctly
- [ ] Modals appear on top of everything
- [ ] Backdrop click closes modal
- [ ] Close button works
- [ ] No console errors
- [ ] Responsive on different screen sizes
