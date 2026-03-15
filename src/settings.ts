import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type ChronosPlugin from "./main";
import { ChronosSettings, ZoomLevel } from "./types";

export class ChronosSettingTab extends PluginSettingTab {
  private plugin: ChronosPlugin;

  constructor(app: App, plugin: ChronosPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Chronos Timeline Settings" });

    // -----------------------------------------------------------------------
    // Date Fields
    // -----------------------------------------------------------------------
    containerEl.createEl("h3", { text: "Date Detection" });

    new Setting(containerEl)
      .setName("Frontmatter date fields")
      .setDesc(
        "Comma-separated list of frontmatter keys to use as the note date, in priority order. " +
        "Example: date, created, published, meeting-date"
      )
      .addTextArea((area) => {
        area
          .setValue(this.plugin.settings.dateFields.join(", "))
          .onChange(async (val) => {
            this.plugin.settings.dateFields = val
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          });
        area.inputEl.rows = 3;
        area.inputEl.cols = 40;
      });

    new Setting(containerEl)
      .setName("Fall back to file creation date")
      .setDesc("If no frontmatter date is found, use the file's creation date.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useFallbackCtime)
          .onChange(async (val) => {
            this.plugin.settings.useFallbackCtime = val;
            await this.plugin.saveSettings();
          })
      );

    // -----------------------------------------------------------------------
    // Display
    // -----------------------------------------------------------------------
    containerEl.createEl("h3", { text: "Display" });

    new Setting(containerEl)
      .setName("Default zoom level")
      .setDesc("The zoom level shown when the timeline is first opened.")
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
      .setDesc("Width of each note card in pixels. Default: 180.")
      .addSlider((slider) =>
        slider
          .setLimits(120, 320, 10)
          .setValue(this.plugin.settings.cardWidth)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.settings.cardWidth = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Maximum lane count")
      .setDesc("Maximum number of stacked rows for notes that share the same time slot. Default: 8.")
      .addSlider((slider) =>
        slider
          .setLimits(2, 20, 1)
          .setValue(this.plugin.settings.maxLanes)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.settings.maxLanes = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show hover preview")
      .setDesc("Show Obsidian's note preview when hovering over a card.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showPreviewTooltip)
          .onChange(async (val) => {
            this.plugin.settings.showPreviewTooltip = val;
            await this.plugin.saveSettings();
          })
      );

    // -----------------------------------------------------------------------
    // Colors
    // -----------------------------------------------------------------------
    containerEl.createEl("h3", { text: "Colors" });

    new Setting(containerEl)
      .setName("Color cards by")
      .setDesc("Choose what determines a card's color.")
      .addDropdown((dd) =>
        dd
          .addOptions({ folder: "Folder", tag: "First tag", none: "None (default blue)" })
          .setValue(this.plugin.settings.colorBy)
          .onChange(async (val) => {
            this.plugin.settings.colorBy = val as "folder" | "tag" | "none";
            await this.plugin.saveSettings();
          })
      );

    // Tag color mappings
    containerEl.createEl("h4", { text: "Tag colors" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: 'Map a tag name (without #) to a hex color. One per line, format: tagname=#hex',
    });

    new Setting(containerEl)
      .setName("Tag → color map")
      .addTextArea((area) => {
        const entries = Object.entries(this.plugin.settings.tagColors)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n");
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
      .addTextArea((area) => {
        const entries = Object.entries(this.plugin.settings.folderColors)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n");
        area.setValue(entries).onChange(async (val) => {
          this.plugin.settings.folderColors = parseColorMap(val);
          await this.plugin.saveSettings();
        });
        area.inputEl.rows = 5;
        area.inputEl.cols = 40;
        area.inputEl.placeholder = "Journal=#4f8ef7\nWork/Projects=#e8a838";
      });

    // -----------------------------------------------------------------------
    // Filtering
    // -----------------------------------------------------------------------
    containerEl.createEl("h3", { text: "Filtering" });

    new Setting(containerEl)
      .setName("Excluded folders")
      .setDesc("Folder paths to exclude from the timeline. One per line.")
      .addTextArea((area) => {
        area
          .setValue(this.plugin.settings.excludeFolders.join("\n"))
          .onChange(async (val) => {
            this.plugin.settings.excludeFolders = val
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          });
        area.inputEl.rows = 4;
        area.inputEl.cols = 40;
        area.inputEl.placeholder = "Templates\nArchive\n.trash";
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
    if (key && /^#[0-9a-fA-F]{3,8}$/.test(val)) {
      result[key] = val;
    }
  }
  return result;
}
