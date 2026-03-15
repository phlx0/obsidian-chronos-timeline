import { App, PluginSettingTab, Setting } from "obsidian";
import type ChronosPlugin from "./main";
import { ZoomLevel } from "./types";

export class ChronosSettingTab extends PluginSettingTab {
  private plugin: ChronosPlugin;

  constructor(app: App, plugin: ChronosPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Chronos Timeline" });

    // -----------------------------------------------------------------------
    // Date detection
    // -----------------------------------------------------------------------
    containerEl.createEl("h3", { text: "Date Detection" });

    new Setting(containerEl)
      .setName("Frontmatter date fields")
      .setDesc("Comma-separated list of frontmatter keys to use as the note date, in priority order.")
      .addTextArea((area) => {
        area
          .setValue(this.plugin.settings.dateFields.join(", "))
          .onChange(async (val) => {
            this.plugin.settings.dateFields = val.split(",").map((s) => s.trim()).filter(Boolean);
            await this.plugin.saveSettings();
          });
        area.inputEl.rows = 3;
        area.inputEl.cols = 40;
      });

    new Setting(containerEl)
      .setName("Fall back to file creation date")
      .setDesc("If no frontmatter date is found, use the file's creation date.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.useFallbackCtime).onChange(async (v) => {
          this.plugin.settings.useFallbackCtime = v;
          await this.plugin.saveSettings();
        })
      );

    // -----------------------------------------------------------------------
    // Display
    // -----------------------------------------------------------------------
    containerEl.createEl("h3", { text: "Display" });

    new Setting(containerEl)
      .setName("Default zoom level")
      .addDropdown((dd) =>
        dd
          .addOptions({ year: "Year", month: "Month", week: "Week", day: "Day" })
          .setValue(this.plugin.settings.defaultZoom)
          .onChange(async (val) => {
            this.plugin.settings.defaultZoom = val as ZoomLevel;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Card width (px)")
      .addSlider((s) =>
        s
          .setLimits(120, 320, 10)
          .setValue(this.plugin.settings.cardWidth)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.cardWidth = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Maximum lane count")
      .addSlider((s) =>
        s
          .setLimits(2, 20, 1)
          .setValue(this.plugin.settings.maxLanes)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.maxLanes = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show hover preview")
      .setDesc("Show Obsidian's native note preview on card hover.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showPreviewTooltip).onChange(async (v) => {
          this.plugin.settings.showPreviewTooltip = v;
          await this.plugin.saveSettings();
        })
      );

    // -----------------------------------------------------------------------
    // Features
    // -----------------------------------------------------------------------
    containerEl.createEl("h3", { text: "Features" });

    new Setting(containerEl)
      .setName("Group by folder (swimlanes)")
      .setDesc("Separate notes into horizontal bands per top-level folder.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableSwimlanes).onChange(async (v) => {
          this.plugin.settings.enableSwimlanes = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Minimap")
      .setDesc("Show a compact overview bar below the timeline.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableMinimap).onChange(async (v) => {
          this.plugin.settings.enableMinimap = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Drag to reschedule")
      .setDesc("Drag a note card to a new date to update its frontmatter date.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableDragReschedule).onChange(async (v) => {
          this.plugin.settings.enableDragReschedule = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Virtualization")
      .setDesc("Only render cards in the visible viewport (recommended for vaults with 150+ dated notes).")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableVirtualization).onChange(async (v) => {
          this.plugin.settings.enableVirtualization = v;
          await this.plugin.saveSettings();
        })
      );

    // -----------------------------------------------------------------------
    // Colors
    // -----------------------------------------------------------------------
    containerEl.createEl("h3", { text: "Colors" });

    new Setting(containerEl)
      .setName("Color cards by")
      .addDropdown((dd) =>
        dd
          .addOptions({ folder: "Folder", tag: "First tag", none: "None" })
          .setValue(this.plugin.settings.colorBy)
          .onChange(async (val) => {
            this.plugin.settings.colorBy = val as "folder" | "tag" | "none";
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h4", { text: "Tag colors" });
    new Setting(containerEl)
      .setName("Tag → color map")
      .setDesc("One per line, format: tagname=#hexcolor")
      .addTextArea((area) => {
        const entries = Object.entries(this.plugin.settings.tagColors)
          .map(([k, v]) => `${k}=${v}`).join("\n");
        area.setValue(entries).onChange(async (val) => {
          this.plugin.settings.tagColors = parseColorMap(val);
          await this.plugin.saveSettings();
        });
        area.inputEl.rows = 5;
        area.inputEl.cols = 40;
        area.inputEl.placeholder = "meeting=#e05c5c\nproject=#48b883";
      });

    containerEl.createEl("h4", { text: "Folder colors" });
    new Setting(containerEl)
      .setName("Folder → color map")
      .setDesc("One per line, format: foldername=#hexcolor")
      .addTextArea((area) => {
        const entries = Object.entries(this.plugin.settings.folderColors)
          .map(([k, v]) => `${k}=${v}`).join("\n");
        area.setValue(entries).onChange(async (val) => {
          this.plugin.settings.folderColors = parseColorMap(val);
          await this.plugin.saveSettings();
        });
        area.inputEl.rows = 5;
        area.inputEl.cols = 40;
        area.inputEl.placeholder = "Journal=#4f8ef7\nWork=#e8a838";
      });

    // -----------------------------------------------------------------------
    // Filtering
    // -----------------------------------------------------------------------
    containerEl.createEl("h3", { text: "Filtering" });

    new Setting(containerEl)
      .setName("Excluded folders")
      .setDesc("One folder path per line.")
      .addTextArea((area) => {
        area
          .setValue(this.plugin.settings.excludeFolders.join("\n"))
          .onChange(async (val) => {
            this.plugin.settings.excludeFolders = val.split("\n").map((s) => s.trim()).filter(Boolean);
            await this.plugin.saveSettings();
          });
        area.inputEl.rows = 4;
        area.inputEl.cols = 40;
        area.inputEl.placeholder = "Templates\nArchive";
      });
  }
}

function parseColorMap(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.lastIndexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && /^#[0-9a-fA-F]{3,8}$/.test(val)) result[key] = val;
  }
  return result;
}
