# Mobile Optimization Guide

## Overview

This document outlines the mobile optimizations implemented for LogExtract to ensure a great experience on mobile browsers.

## Key Mobile Optimizations

### 1. Viewport Settings
- **Meta viewport**: Configured for responsive design with `user-scalable=yes` and `maximum-scale=5.0`
- **Apple mobile web app**: Enabled with black-translucent status bar
- Prevents unwanted zoom but allows user scaling when needed

### 2. Touch-Friendly Targets
All interactive elements meet the **44x44px minimum** touch target size:
- Buttons have `min-h-[44px]` on mobile (reduced to normal size on desktop with `sm:min-h-0`)
- Input fields have larger padding on mobile (`py-2 sm:py-1.5`)
- Navigation buttons optimized for touch

### 3. Responsive Layout
- **Sidebar Navigation**: 
  - Full width on mobile, fixed width (256px) on desktop
  - Stacks vertically on mobile, horizontal on desktop (`flex-col md:flex-row`)
  - Scrollable on mobile with `overflow-y-auto`
  
- **Header**:
  - Stacks vertically on mobile, horizontal on desktop (`flex-col sm:flex-row`)
  - Truncates long titles on mobile
  - Hides less important elements on small screens (`hidden md:flex`)
  
- **Table Controls**:
  - Date format and year adjustment stack vertically on mobile
  - Full-width controls on mobile with proper spacing

### 4. Table Optimization
- **Horizontal Scrolling**: Tables have smooth horizontal scroll on mobile
- **Touch Scrolling**: Added `-webkit-overflow-scrolling: touch` for smooth iOS scrolling
- **Sticky Columns**: Date and Tail # columns remain visible while scrolling horizontally
- **Responsive Font Size**: Smaller font size on mobile (`text-[11px] sm:text-xs`)

### 5. Input Optimization
- **Numeric Inputs**: Use `inputMode="numeric"` for date inputs (shows numeric keypad on mobile)
- **Larger Touch Targets**: All inputs have minimum 44px height on mobile
- **Better Spacing**: Increased padding for easier tapping

### 6. Content Hiding
Less important information is hidden on small screens:
- Total hours display (hidden below `lg` breakpoint)
- Email display in header (hidden below `md` breakpoint)
- Some button labels shortened on mobile
- OCR badge hidden on very small screens

### 7. Button Optimizations
- **Full-width buttons**: "Manual Row" button is full-width on mobile
- **Icon-only buttons**: Some buttons show only icons on mobile, labels on desktop
- **Stacked layouts**: Buttons stack vertically when needed on mobile

## Breakpoints Used

- **sm**: 640px (Small tablets)
- **md**: 768px (Tablets)
- **lg**: 1024px (Small desktops)
- **xl**: 1280px (Large desktops)

## Testing Recommendations

Test on:
- ✅ iPhone (Safari) - iOS 14+
- ✅ Android (Chrome) - Android 10+
- ✅ iPad (Safari)
- ✅ Mobile browsers (Chrome, Firefox, Edge)

## Known Limitations

1. **Wide Tables**: Entry tables require horizontal scrolling on mobile (by design)
2. **Image Viewer**: May need pinch-to-zoom on very small screens
3. **Sidebar**: Always visible on mobile (may consider collapsible menu in future)

## Future Improvements

- [ ] Collapsible sidebar menu for mobile
- [ ] Swipe gestures for table navigation
- [ ] Mobile-specific table views (card layout option)
- [ ] Bottom navigation bar for mobile
- [ ] Pull-to-refresh for data updates
