# Changelog

All notable changes to Chronos Timeline are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.2.0] — 2026-03-15

### Added
- **Gantt bars** — Notes with an end-date frontmatter field (configurable, default `end-date`) are rendered as horizontal spanning bars showing their full duration
- **Recurring events** — Notes with a `recurrence` field (`daily`, `weekly`, `biweekly`, `monthly`, `yearly`) generate ghost copies across the visible timeline range. Ghost cards are rendered with a dashed border
- **Dataview integration** — Set a Dataview source expression in Settings to filter which notes appear (e.g. `"Projects"` or `#journal`). Requires the Dataview plugin
- **Per-note color override** — Add `chronos-color: #hexcode` to any note's frontmatter to override its card color independently of the global colorBy setting
- **Export as PNG** — New Export button in the toolbar renders the current timeline to a canvas and downloads it as a PNG file
- **Note preview panel** — Optional right-side panel that renders the selected note's full content via Obsidian's MarkdownRenderer (links and embeds work correctly). Toggle in Settings → Features
- **Search bar in toolbar** — Search input is now always visible in the toolbar instead of being hidden behind the Filters button
- **Jump-to-date input** — Date picker in the toolbar scrolls the timeline directly to the chosen date
- **Keyboard shortcuts** — `+`/`-` zoom in/out, `T` jump to today, `F` toggle filter panel, `H` toggle heatmap, `E` export
- **Note count badge per swimlane** — Each swimlane header now shows the number of notes in that group
- **Color legend overlay** — Optional floating legend (bottom-right) showing which color corresponds to which folder or tag. Toggle in Settings → Display
- **Relative date labels** — Cards can optionally show "2 days ago", "In 3 months" etc. instead of absolute dates. Toggle in Settings → Display
- **Filter state persistence** — Active filter selections are saved to localStorage and restored across sessions. Toggle in Settings → Features
- **Touch drag to reschedule** — Mobile drag-to-reschedule now works via touch events (touchstart / touchmove / touchend)
- New commands: `Zoom in`, `Zoom out`, `Toggle heatmap / timeline view`, `Toggle filter panel`
- New settings sections: Gantt Mode, Recurring Events, Dataview Integration
- New settings: `showRelativeDates`, `showColorLegend`, `enablePreviewPanel`, `persistFilters`, `enableGantt`, `ganttEndField`, `enableRecurring`, `recurringField`, `dataviewQuery`

### Changed
- Swimlane header now includes a note count badge next to the folder label

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
