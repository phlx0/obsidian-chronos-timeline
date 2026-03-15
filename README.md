# Chronos Timeline

**Visualize your Obsidian vault on an interactive, scrollable timeline.**

Chronos Timeline is the Obsidian plugin the community has requested for years (41,000+ forum views for this concept). It plots every note on a horizontal time axis based on any frontmatter date field, letting you explore your knowledge base temporally.

---

## Features

- **Interactive timeline** — Scroll horizontally through time, zoom in and out
- **Four zoom levels** — Year · Month · Week · Day
- **Smart date detection** — Reads any frontmatter date field (`date`, `created`, `published`, `meeting-date`, or your custom fields). Falls back to file creation time
- **Automatic lane assignment** — Notes that share the same time slot are stacked into separate rows — no overlap, ever
- **Filter panel** — Filter by tag, folder, date range, or title search
- **Color coding** — Color cards by folder or first tag, with per-folder and per-tag hex color overrides
- **Hover preview** — Native Obsidian link-preview on card hover
- **Today line** — A highlighted line marks the current date. "Today" button scrolls to it instantly
- **Theme compatible** — Uses Obsidian CSS variables. Works with every community theme out of the box
- **Mobile ready** — Responsive layout that works on the Obsidian mobile app

---

## Installation

### From the Community Plugin Browser (once published)

1. Open **Settings → Community plugins → Browse**
2. Search for `Chronos Timeline`
3. Click **Install**, then **Enable**

### Manual Installation (development)

```bash
cd /path/to/vault/.obsidian/plugins/
git clone https://github.com/your-username/obsidian-chronos-timeline
cd obsidian-chronos-timeline
npm install
npm run build
```

Then reload Obsidian and enable the plugin under **Settings → Community plugins**.

---

## Usage

### Opening the Timeline

- Click the **calendar icon** in the left ribbon, or
- Use the command palette: `Chronos Timeline: Open timeline`

### Date Fields

Add a date to any note's frontmatter:

```yaml
---
date: 2024-03-15
---
```

Or use any field name you like — just add it to the **Date Fields** list in settings:

```yaml
---
meeting-date: 2024-03-20
published: 2023-11-01
---
```

### Zoom Levels

| Level | Best for |
|-------|----------|
| **Year** | Large vaults — see the big picture across years |
| **Month** | Daily notes, journals, project notes |
| **Week** | Meeting notes, weekly reviews |
| **Day** | Dense schedules, daily planning |

### Keyboard Shortcuts

You can assign custom hotkeys to the commands:
- `Chronos Timeline: Open timeline`

Go to **Settings → Hotkeys** and search for `Chronos`.

---

## Configuration

All settings are available under **Settings → Chronos Timeline**.

| Setting | Description | Default |
|---------|-------------|---------|
| Frontmatter date fields | Priority-ordered list of frontmatter keys to try | `date, created, published, meeting-date, event-date` |
| Fall back to file creation date | Use `ctime` if no frontmatter date found | `true` |
| Default zoom level | Zoom when first opening the view | `month` |
| Card width | Width of note cards in pixels | `180` |
| Maximum lane count | Max stacked rows in the timeline | `8` |
| Show hover preview | Enable Obsidian's native note hover | `true` |
| Color cards by | `folder`, `tag`, or `none` | `folder` |
| Tag → color map | Map tag names to hex colors | _(empty)_ |
| Folder → color map | Map folder paths to hex colors | _(empty)_ |
| Excluded folders | Folder paths to hide from the timeline | _(empty)_ |

### Color Map Format

In the settings text areas, enter one mapping per line:

```
Journal=#4f8ef7
Work/Projects=#e8a838
meeting=#e05c5c
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

### Development Setup

```bash
git clone https://github.com/your-username/obsidian-chronos-timeline
cd obsidian-chronos-timeline
npm install
npm run dev    # watches and rebuilds on save
```

Place or symlink the repository into your vault's `.obsidian/plugins/` directory for live testing.

### Project Structure

```
obsidian-chronos-timeline/
├── src/
│   ├── main.ts              # Plugin entry point, command & view registration
│   ├── settings.ts          # Settings tab UI
│   ├── types.ts             # TypeScript interfaces and constants
│   ├── views/
│   │   └── TimelineView.ts  # Main ItemView — renders the timeline
│   ├── components/
│   │   ├── NoteCard.ts      # Individual note card DOM factory
│   │   └── FilterPanel.ts   # Filter sidebar component
│   └── utils/
│       ├── dateParser.ts    # Frontmatter date extraction and parsing
│       └── noteLoader.ts    # Vault scanning, color resolution, lane assignment
├── styles/
│   └── main.css             # All styling (theme-compatible via CSS variables)
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── versions.json
```

---

## Roadmap

- [ ] Calendar heatmap view (GitHub contribution graph style)
- [ ] Circular/year-in-review view
- [ ] Export timeline as PNG/SVG
- [ ] Drag notes to change their dates
- [ ] Dataview integration for custom date queries
- [ ] Group notes into swimlanes by folder/tag

---

## License

MIT © Chronos Timeline Contributors
