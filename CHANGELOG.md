# Changelog

All notable changes to Chronos Timeline are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

---

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
