# Name Display Consistency Update

## Overview

Updated name display to ensure consistency across different views:

- **Class student list**: Always shows "Firstname Lastname" (administrative clarity)
- **Live session & Teams**: Respects individual student name display preferences (flexibility)

## Changes Made

### Updated Live Session Student Bubbles

**Location 1 - Active Session Students** (line ~3922):

```vue
<!-- Before -->
{{ formatStudentFullName(student) }}

<!-- After -->
{{ formatStudentName(student) }}
```

**Location 2 - Preview Students** (line ~3941):

```vue
<!-- Before -->
{{ formatStudentFullName(student) }}

<!-- After -->
{{ formatStudentName(student) }}
```

### Already Correct

**Drag Clone** (line ~2727):

- ✅ Already uses `formatStudentName(student)` - respects preferences

**Class Student List** (line ~2871):

- ✅ Already uses `formatStudentFullName(student)` - always shows full name

## Name Display Behavior by Context

### 1. Class Student List (Administrative)

**Function:** `formatStudentFullName()`
**Display:** Always "Firstname Lastname"
**Purpose:** Clear identification, no confusion

**Examples:**

- John Smith
- Marie Dupont
- Carlos Garcia

### 2. Live Session Students (Activity)

**Function:** `formatStudentName()`
**Display:** Respects individual preferences
**Purpose:** Teacher customization for engagement

**Examples based on preferences:**

- If "Surnom" checked: "Bob"
- If "Prénom + Surnom": "Bob John"
- If "Prénom + Initiale": "John S."
- If all checked: "Bob John S. Smith"
- If defaults: "John Smith"

### 3. Team Displays (Activity)

**Function:** `formatStudentName()`
**Display:** Respects individual preferences
**Purpose:** Same as live session - flexible display

### 4. Drag Clone (Activity)

**Function:** `formatStudentName()`
**Display:** Respects individual preferences
**Purpose:** Consistent with live session display

## Function Comparison

### `formatStudentFullName(student)`

```javascript
// Always returns: "Firstname Lastname"
// Ignores all preferences
// Used for: Administrative lists, reports
```

### `formatStudentName(student)`

```javascript
// Returns based on preferences:
// - showCustomName (surnom)
// - showFirstname
// - showInitial
// - showLastname
// Used for: Live sessions, teams, activities
```

## User Experience

### For Teachers:

1. **In Class Management:**
   - See all students clearly identified
   - No confusion about who is who
   - Consistent formatting

2. **In Live Sessions:**
   - Customize how each student's name appears
   - Use nicknames for engagement
   - Show only what's needed for quick recognition
   - Different display per student based on preference

### For Students:

- May see their preferred name/nickname during activities
- Official name still used for administrative purposes

## Testing Checklist

- [ ] Open class detail - verify all students show "Firstname Lastname"
- [ ] Start live session - verify student bubbles respect preferences
- [ ] Set student preference to show only surnom
- [ ] Verify surnom appears in live session bubble
- [ ] Verify full name still appears in class list
- [ ] Test with teams active - verify team members show preferred names
- [ ] Drag a student - verify drag clone shows preferred name
- [ ] Check preview area - verify bubbles show preferred names
