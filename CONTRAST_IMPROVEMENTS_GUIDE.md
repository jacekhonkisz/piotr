# Text Contrast Improvements Guide

This document outlines the comprehensive text contrast improvements implemented to ensure all text is properly readable against its background throughout the application.

## Overview

The application now includes a robust contrast system that ensures:
- Dark text on light backgrounds
- Light text on dark backgrounds  
- Proper contrast ratios meeting WCAG AA standards
- Automatic contrast detection and application

## Key Improvements Made

### 1. Enhanced Global CSS (`src/app/globals.css`)

#### New CSS Custom Properties
```css
:root {
  --text-on-light: #0f172a;     /* Dark text for light backgrounds */
  --text-on-dark: #ffffff;      /* Light text for dark backgrounds */
  --text-muted-on-light: #475569; /* Muted dark text for light backgrounds */
  --text-muted-on-dark: #cbd5e1;  /* Muted light text for dark backgrounds */
}
```

#### New Utility Classes
- `.text-contrast-light` - Dark text for light backgrounds
- `.text-contrast-dark` - Light text for dark backgrounds
- `.text-contrast-muted-light` - Muted dark text
- `.text-contrast-muted-dark` - Muted light text
- `.bg-light`, `.bg-dark` - Auto-contrast backgrounds

### 2. Enhanced Tailwind Configuration (`tailwind.config.js`)

Added contrast color definitions and text utilities:
```javascript
colors: {
  contrast: {
    'light-bg': '#ffffff',
    'light-text': '#0f172a',
    'light-text-muted': '#475569',
    'dark-bg': '#1e293b', 
    'dark-text': '#ffffff',
    'dark-text-muted': '#cbd5e1',
  }
}
```

### 3. Contrast Utility Functions (`src/lib/contrast-utils.ts`)

New utility functions for automatic contrast:
- `isLightBackground()` - Determines if background is light or dark
- `getContrastingTextColor()` - Returns appropriate text color
- `getSafeTextColor()` - Gets safe text color for specific contexts
- `validateContrast()` - Validates WCAG compliance

### 4. ContrastText Component (`src/components/ContrastText.tsx`)

React component for automatic text contrast:
```tsx
<ContrastText backgroundColor="white" type="primary">
  Automatically contrasted text
</ContrastText>

<ContrastTitle backgroundColor="bg-gray-800">
  Auto-contrasted title
</ContrastTitle>
```

## Component Updates Made

### Fixed Components:
1. **DiagonalChart** - Added proper text color classes
2. **MiniChartsCarousel** - Improved background opacity and text contrast
3. **Test pages** - Updated to demonstrate proper contrast usage

### Updated CSS Classes:
- Enhanced button styles with better contrast
- Improved form input contrast
- Fixed modal and tooltip text contrast
- Updated card and navigation contrast

## Usage Guidelines

### For New Components:
1. Use `ContrastText` component for automatic contrast
2. Apply `.text-contrast-light` or `.text-contrast-dark` classes
3. Use contrast utility functions for dynamic scenarios

### For Existing Components:
1. Replace light gray text on light backgrounds with darker colors
2. Ensure white text is only on dark backgrounds
3. Use semantic color classes for status indicators

## WCAG Compliance

The implemented contrast system ensures:
- **WCAG AA**: Minimum 4.5:1 contrast ratio for normal text
- **WCAG AAA**: 7:1 contrast ratio for enhanced accessibility
- Proper color combinations for all UI states

## Testing Contrast

Use the test page at `/test-tailwind` to verify contrast improvements:
- Light background examples
- Dark background examples  
- Various color combinations
- Interactive elements

## Quick Reference

### Safe Color Combinations:

**Light Backgrounds:**
- Primary: `text-gray-900`
- Secondary: `text-gray-600` 
- Muted: `text-gray-500`
- Links: `text-blue-600`

**Dark Backgrounds:**
- Primary: `text-white`
- Secondary: `text-gray-300`
- Muted: `text-gray-400`  
- Links: `text-blue-400`

### Utility Classes:
```css
.text-on-light    /* Dark text for light backgrounds */
.text-on-dark     /* Light text for dark backgrounds */
.bg-light         /* White background with dark text */
.bg-dark          /* Dark background with light text */
```

This contrast system ensures excellent readability and accessibility throughout the application while maintaining the modern design aesthetic. 