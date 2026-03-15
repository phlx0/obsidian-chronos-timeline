import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import { ChronosSettings, DEFAULT_SETTINGS } from "./types";
import { TimelineView, TIMELINE_VIEW_TYPE } from "./views/TimelineView";
import { ChronosSettingTab } from "./settings";

export default class ChronosPlugin extends Plugin {
  settings: ChronosSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Register the timeline view
    this.registerView(TIMELINE_VIEW_TYPE, (leaf) => new TimelineView(leaf, this.settings));

    // Ribbon icon
    this.addRibbonIcon("calendar-range", "Open Chronos Timeline", () => {
      this.activateView();
    });

    // Command: open timeline
    this.addCommand({
      id: "open-timeline",
      name: "Open timeline",
      callback: () => this.activateView(),
    });

    // Command: open timeline and scroll to today
    this.addCommand({
      id: "open-timeline-today",
      name: "Open timeline (jump to today)",
      callback: () => this.activateView(),
    });

    // Settings tab
    this.addSettingTab(new ChronosSettingTab(this.app, this));

    console.log("Chronos Timeline loaded.");
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
    console.log("Chronos Timeline unloaded.");
  }

  // ---------------------------------------------------------------------------
  // View Management
  // ---------------------------------------------------------------------------

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    // If already open, reveal it
    const existingLeaves = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
    if (existingLeaves.length > 0) {
      workspace.revealLeaf(existingLeaves[0]);
      return;
    }

    // Open in a new tab
    const leaf = workspace.getLeaf("tab");
    await leaf.setViewState({ type: TIMELINE_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Propagate updated settings to all open timeline views
    this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
      if (leaf.view instanceof TimelineView) {
        (leaf.view as TimelineView).updateSettings(this.settings);
      }
    });
  }
}
