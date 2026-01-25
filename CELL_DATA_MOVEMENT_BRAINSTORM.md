# Cell Data Movement - Brainstorming Options

## Problem
When AI extracts data, sometimes values end up in the wrong column (e.g., PIC time in Dual Received, or vice versa). Users need an easy way to move data between adjacent cells.

## Option 1: Drag and Drop Between Cells ⭐ (Recommended)
**How it works:**
- Click and hold on a cell's value
- Drag to a neighboring cell
- Drop to swap or move the value

**Pros:**
- Intuitive and visual
- Works well on desktop
- Clear visual feedback during drag

**Cons:**
- Can be tricky on mobile/touch devices
- Need to handle edge cases (dragging to non-editable cells)

**Implementation:**
- Add `draggable={true}` to input cells
- Track `onDragStart`, `onDragOver`, `onDrop` events
- Show visual indicator (ghost element) during drag
- Swap values on drop

---

## Option 2: Click-to-Select, Then Click Destination
**How it works:**
- Click a cell to "select" it (highlighted border)
- Click destination cell to move/swap the value
- ESC to cancel selection

**Pros:**
- Works perfectly on mobile and desktop
- Simple mental model
- No accidental drags

**Cons:**
- Two clicks required
- Less intuitive than drag-and-drop

**Implementation:**
- Add `selectedCell` state: `{ entryId: string, field: string }`
- Highlight selected cell with border/background
- On second click, swap/move values

---

## Option 3: Right-Click Context Menu
**How it works:**
- Right-click on a cell
- Menu shows: "Move to [Left Cell]", "Move to [Right Cell]", "Swap with [Left]", "Swap with [Right]"
- Click option to execute

**Pros:**
- Very clear about what will happen
- Shows available neighbors
- Familiar pattern (right-click menus)

**Cons:**
- Desktop-only (no right-click on mobile)
- Requires knowing which direction to move

**Implementation:**
- Context menu component
- Detect cell position to show relevant options
- Execute move/swap on selection

---

## Option 4: Arrow Key Shortcuts
**How it works:**
- Focus on a cell
- Ctrl/Cmd + Arrow Left/Right to move value to adjacent cell
- Shift + Arrow to swap values

**Pros:**
- Fast for power users
- Keyboard-only workflow
- No mouse needed

**Cons:**
- Requires learning shortcuts
- Not discoverable
- Mobile keyboards may not have arrow keys

**Implementation:**
- Add `onKeyDown` handler to inputs
- Detect Ctrl/Cmd + Arrow combinations
- Move or swap based on modifier keys

---

## Option 5: Double-Click to Swap with Neighbor
**How it works:**
- Double-click a cell
- Swaps value with the cell to the right (or left if on right edge)
- Visual animation shows the swap

**Pros:**
- Very quick for common case (adjacent swap)
- Single gesture
- Works on all devices

**Cons:**
- Only works for immediate neighbors
- Can't move to non-adjacent cells
- Might conflict with double-click to select text

**Implementation:**
- Track double-click timing
- Detect which neighbor to swap with
- Animate swap transition

---

## Option 6: Hover Buttons on Cell Edges
**How it works:**
- Hover over a cell
- Small arrow buttons appear on left/right edges
- Click arrow to move value in that direction

**Pros:**
- Very clear visual affordance
- Shows available actions
- Works on hover (desktop) or tap (mobile)

**Cons:**
- Takes up visual space
- Might be cluttered in dense table
- Requires hover state (mobile needs tap)

**Implementation:**
- Show/hide buttons on hover
- Position absolutely on cell edges
- Handle click to move value

---

## Option 7: Copy/Paste with Visual Feedback
**How it works:**
- Click cell to "copy" (visual highlight)
- Click destination to "paste" (moves value)
- Shows clipboard icon or "Copied" indicator

**Pros:**
- Familiar pattern (copy/paste)
- Works on all devices
- Can paste multiple times

**Cons:**
- Two-step process
- Less intuitive for "move" vs "copy"

**Implementation:**
- Track "copied" cell state
- Highlight source cell
- On paste, move value and clear copy state

---

## Option 8: Touch Gestures (Mobile)
**How it works:**
- Long-press cell to select
- Swipe left/right to move value in that direction
- Visual feedback during swipe

**Pros:**
- Native mobile feel
- Gesture-based (no buttons)
- Fast once learned

**Cons:**
- Mobile-only
- Requires gesture library
- Less discoverable

**Implementation:**
- Use touch event handlers
- Detect swipe direction
- Move value on swipe completion

---

## Recommended Hybrid Approach

**Primary: Click-to-Select + Click-Destination (Option 2)**
- Works on all devices
- Simple and reliable
- No accidental actions

**Secondary: Drag-and-Drop (Option 1)**
- For desktop power users
- More intuitive visual feedback
- Optional enhancement

**Tertiary: Keyboard Shortcuts (Option 4)**
- For advanced users
- Fast workflow
- Document in tooltip/help

---

## Implementation Priority

1. **Phase 1:** Click-to-select + click-destination (universal, reliable)
2. **Phase 2:** Add drag-and-drop for desktop (enhanced UX)
3. **Phase 3:** Add keyboard shortcuts (power user feature)

---

## Visual Design Considerations

- **Selected cell:** Blue border, slight background tint
- **Valid drop target:** Green border highlight on hover
- **Invalid drop target:** Red border or no highlight
- **During drag:** Ghost element following cursor
- **After move:** Brief animation showing value moving

---

## Edge Cases to Handle

- Moving to read-only cells (Day, which is auto-calculated)
- Moving between different entry rows
- Moving to cells that trigger validation (aircraft ID)
- Undo/redo support for moves
- Mobile touch vs desktop mouse
