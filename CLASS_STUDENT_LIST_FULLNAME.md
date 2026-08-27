# Class Student List - Full Name Display

## Overview

Updated the class student list to always display first name + last name, regardless of individual student name display preferences.

## Changes Made

### 1. Created `formatStudentFullName()` Function

A new function that always returns "Firstname Lastname" format:

```javascript
function formatStudentFullName(student) {
  if (!student) return "";
  const parts = [];
  if (student.firstname) parts.push(student.firstname);
  if (student.lastname) parts.push(student.lastname);
  return parts.join(" ") || student.firstname || "";
}
```

### 2. Updated Student List Displays

Replaced `formatStudentName()` with `formatStudentFullName()` in:

**Class Student List** (line ~2854):

- When viewing students in a selected class
- Always shows: "John Smith"

**Student Bubbles Preview** (lines ~3983, ~4002):

- Student bubbles in the session preview area
- Always shows: "John Smith"

### 3. Preserved `formatStudentName()` Function

The original function remains unchanged and is still used in:

- Live session student cards (respects user preferences)
- Student detail preview
- Anywhere personalized name display is needed

## Behavior

### Before:

- Class list showed names based on each student's preferences
- If student had "Surnom" checked → showed surnom
- If student had only initial → showed "John S."

### After:

- **Class list ALWAYS shows**: "John Smith" (first + last)
- **Live session cards STILL respect preferences**: Can show surnom, initials, etc.

## Use Cases

### Class Student List (Full Name):

✅ Administrative clarity
✅ Easy identification
✅ Consistent formatting
✅ No confusion about who is who

### Live Session Cards (Preferences):

✅ Teacher can customize display during activities
✅ Use nicknames for engagement
✅ Show only what's needed for quick recognition
✅ Flexible per-student customization

## Testing Checklist

- [ ] Open a class and verify all students show "Firstname Lastname"
- [ ] Check student with surnom set - should still show full name in class list
- [ ] Check student with only initial preference - should still show full name in class list
- [ ] Start a live session - student cards should respect individual preferences
- [ ] Verify student bubbles in preview show full names
