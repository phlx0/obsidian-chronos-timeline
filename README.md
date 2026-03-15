# Chronos Timeline

[![GitHub release](https://img.shields.io/github/v/release/phlx0/obsidian-chronos-timeline)](https://github.com/phlx0/obsidian-chronos-timeline/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=7c3aed&label=downloads&query=%24%5B%22obsidian-chronos-timeline%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=obsidian-chronos-timeline)

**Visualize your entire Obsidian vault on an interactive, scrollable timeline.**

Stop browsing your notes as a flat list. Chronos Timeline plots every note on a horizontal time axis based on its date, giving you a spatial, temporal view of your knowledge base — how it grew, when ideas clustered, and what happened when.

---

## Features

### Timeline View
An interactive horizontal timeline you can scroll, zoom, and filter.

- **4 zoom levels** — Year, Month, Week, Day
- **Smart lane assignment** — Notes that overlap in time stack into separate rows automatically. No overlap, ever
- **Color coding** — Cards colored by folder or first tag, fully customizable
- **Per-note color override** — Add `chronos-color: #hexcode` to any note's frontmatter
- **Today line** — A highlighted line marks today. "Today" button jumps to it instantly
- **Click to select, double-click to open** — Single click highlights a card and shows a hover preview; double-click opens the note
- **Color legend** — Optional floating overlay shows which color maps to which folder or tag

### Heatmap View
A GitHub contribution graph for your vault — switch with one click in the toolbar.

- One cell per day, colored by note density
- Covers all years present in your vault
- Click any day to filter the timeline to that date
- Intensity legend included

### Gantt Mode
Notes with an end-date frontmatter field are rendered as horizontal spanning bars, showing their full duration. Perfect for projects, events, and multi-day tasks.

```yaml
---
date: 2024-03-01
end-date: 2024-03-15
---
```

### Recurring Events
Notes with a `recurrence` field automatically generate ghost copies across the visible timeline range.

```yaml
---
date: 2024-01-01
recurrence: weekly   # daily | weekly | biweekly | monthly | yearly
---
```

### Swimlanes
Group notes into horizontal bands by top-level folder — see your Journal, Work, and Research notes on separate tracks simultaneously. Each swimlane shows a note count badge.

### Drag to Reschedule
Drag any note card to a new date on the timeline. The frontmatter date field updates automatically. Touch drag works on mobile too.

### Note Preview Panel
Click any card to render the full note content in a side panel — links and embeds work correctly via Obsidian's MarkdownRenderer.

### Create Notes from the Timeline
Double-click any empty area on the timeline to open a "New note" dialog with the clicked date pre-filled.

### Minimap
A compact overview bar below the timeline shows all notes as colored dots. Click anywhere to jump. The viewport indicator shows exactly where you are in the full timeline.

### Dataview Integration
Use any Dataview source expression to filter which notes appear on the timeline. Requires the [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin.

```
"Projects"
#meeting OR #event
```

### Export as PNG
Click **Export** in the toolbar to download the current timeline as a PNG image — useful for sharing project timelines or weekly reviews.

### Virtualization
Only note cards in the visible viewport are rendered in the DOM. Works smoothly even with 1,000+ dated notes.

---

## Installation

### Community Plugin Browser _(once listed)_

1. **Settings → Community plugins → Browse**
2. Search for `Chronos Timeline`
3. **Install** → **Enable**

### Manual

```bash
cd /path/to/vault/.obsidian/plugins/
git clone https://github.com/phlx0/obsidian-chronos-timeline
cd obsidian-chronos-timeline
npm install && npm run build
```

Reload Obsidian and enable the plugin under **Settings → Community plugins**.

---

## Quick Start

1. Open the timeline via the **calendar icon** in the left ribbon, or press the command palette shortcut (`Chronos Timeline: Open timeline`)
2. Notes with a `date:` field in their frontmatter appear immediately
3. If you have no dated notes yet, add this to any note's frontmatter:

```yaml
---
date: 2024-03-15
---
```

4. Use any field name — just add it to **Settings → Date fields**:

```yaml
---
meeting-date: 2024-03-20
published: 2023-11-01
---
```

---

## Usage

### Navigating the Timeline

| Action | Result |
|--------|--------|
| Scroll horizontally | Move through time |
| Click a zoom button | Change time scale |
| Type in search box | Filter by title instantly |
| Pick a date in the jump input | Scroll to that date |
| Click **Today** | Scroll to current date |
| Single-click a card | Select and open preview panel |
| Double-click a card | Open the note |
| Drag a card | Reschedule (updates frontmatter) |
| Double-click empty area | Create a new note at that date |
| Click minimap | Jump to that position |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `T` | Jump to today |
| `F` | Toggle filter panel |
| `H` | Toggle heatmap / timeline |
| `E` | Export as PNG |

### Zoom Levels

| Level | Best for |
|-------|----------|
| **Year** | Large vaults — see the big picture across years |
| **Month** | Daily notes, journals, project timelines |
| **Week** | Meeting notes, weekly reviews |
| **Day** | Dense schedules and daily planning |

### Filtering

The search bar is always visible in the toolbar. For advanced filters, click **Filters** to open the filter panel:
- Filter by tag or folder
- Restrict to a date range

Filter state can be persisted across sessions (Settings → Features → Remember filter state).

---

## Configuration

**Settings → Chronos Timeline**

### Date Detection

| Setting | Default |
|---------|---------|
| Frontmatter date fields (priority order) | `date, created, published, meeting-date, event-date` |
| Fall back to file creation date | `on` |

### Display

| Setting | Default |
|---------|---------|
| Default zoom level | Month |
| Card width | 180px |
| Maximum lane count | 8 |
| Show hover preview | `on` |
| Show relative dates on cards | `off` |
| Show color legend | `on` |

### Features

| Setting | Default |
|---------|---------|
| Swimlanes (group by folder) | `off` |
| Minimap | `on` |
| Drag to reschedule | `on` |
| Virtualization | `on` |
| Note preview panel | `on` |
| Remember filter state | `on` |

### Gantt Mode

| Setting | Default |
|---------|---------|
| Enable Gantt bars | `off` |
| End date field | `end-date` |

### Recurring Events

| Setting | Default |
|---------|---------|
| Enable recurring events | `off` |
| Recurrence field | `recurrence` |

### Dataview Integration

| Setting | Default |
|---------|---------|
| Dataview source query | _(blank — uses all vault notes)_ |

### Colors

Set `colorBy` to **Folder**, **First tag**, or **None**.

Custom color maps (one per line, `name=#hexcolor`):

```
Journal=#4f8ef7
Work=#e8a838
meeting=#e05c5c
project=#48b883
```

Per-note override (in frontmatter):

```yaml
chronos-color: #e05c5c
```

### Excluded Folders

List folder paths (one per line) to hide from the timeline entirely:

```
Templates
Archive
.trash
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

### Development setup

```bash
git clone https://github.com/phlx0/obsidian-chronos-timeline
cd obsidian-chronos-timeline
npm install
npm run dev
```

Symlink or copy the folder into a test vault's `.obsidian/plugins/` directory. After any change, reload Obsidian with **Ctrl+R**.

### Running tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

### Project structure

```
src/
  main.ts                  Plugin entry point, commands, view registration
  settings.ts              Settings tab UI
  types.ts                 Shared interfaces and constants
  views/
    TimelineView.ts        Main ItemView — timeline + heatmap orchestration
    HeatmapRenderer.ts     GitHub-style calendar heatmap
  components/
    NoteCard.ts            Note card DOM factory (touch drag, relative dates, Gantt)
    FilterPanel.ts         Filter sidebar (localStorage persistence)
    Minimap.ts             Overview minimap
    CreateNoteModal.ts     New-note dialog
    PreviewPanel.ts        Side panel — renders note via MarkdownRenderer
  utils/
    dateParser.ts          Frontmatter date extraction
    noteLoader.ts          Vault scanning, lane assignment, Dataview, recurring expansion
    frontmatterEditor.ts   Frontmatter date update (drag reschedule)
    recurringDates.ts      Recurring event date generation
    dataviewIntegration.ts Dataview API access helpers
    exportUtils.ts         Canvas-based PNG export
  __tests__/               Vitest unit tests (35 tests)
  __mocks__/               Obsidian API stubs for testing
styles/
  main.css                 Source stylesheet (CSS variable based)
styles.css                 Obsidian-required root copy
```

---

## License

MIT © [phlx0](https://github.com/phlx0)
