# Changelog

All notable changes to Chronos Timeline are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.1.0] — 2026-03-15

### Added
- **Calendar heatmap view** — GitHub contribution graph style, showing note density per day across all years. Click a day to filter the timeline to that date. Toggle between Timeline and Heatmap in the toolbar
- **Swimlanes** — Notes grouped into horizontal bands per top-level folder (toggle in Settings → Features)
- **Minimap** — Compact overview bar below the timeline showing all notes as colored dots with a draggable viewport indicator. Click anywhere to jump
- **Drag to reschedule** — Drag any note card to a new date; the frontmatter date field is updated automatically
- **Double-click to create note** — Double-click on an empty area of the timeline to open a "Create note" modal with the clicked date pre-filled
- **Single / double click** — Single click now selects a card (highlights it); double click opens the note. Previous behavior was single click to open
- **Word count bar** — A thin colored bar at the bottom of each card shows relative note length
- **Loading spinner** — Spinner shown while the vault is being scanned
- **Virtualization** — Only DOM nodes for cards in the visible viewport are rendered; improves performance on vaults with 150+ dated notes (toggle in Settings → Features)
- New settings: swimlanes, minimap, drag reschedule, virtualization toggles

## [1.0.0] — 2026-03-15

### Added
- Interactive horizontal timeline view for all vault notes
- Four zoom levels: Year, Month, Week, Day
- Automatic note-card placement using a greedy lane-assignment algorithm (no overlapping cards)
- Date detection from any frontmatter field, with configurable priority order
- Fallback to file creation time when no frontmatter date is found
- Filter panel with tag, folder, date-range, and title search filters
- "Today" line and scroll-to-today button
- Color coding by folder or first tag, with fully customizable hex colors
- Hover preview integration with Obsidian's native link-hover system
- Click to open note; Ctrl/Cmd+click opens in a new tab
- Excluded folders setting
- Settings tab with all options exposed
- Live settings propagation to open timeline views
- Automatic re-render on vault file changes (debounced)
- Full Obsidian theme compatibility via CSS variables
- Mobile-responsive layout
