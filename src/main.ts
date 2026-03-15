import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import { ChronosSettings, DEFAULT_SETTINGS, ZOOM_ORDER } from "./types";
import { TimelineView, TIMELINE_VIEW_TYPE } from "./views/TimelineView";
import { ChronosSettingTab } from "./settings";

export default class ChronosPlugin extends Plugin {
  settings: ChronosSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(TIMELINE_VIEW_TYPE, (leaf) => new TimelineView(leaf, this.settings, this.app));

    this.addRibbonIcon("calendar-range", "Open Chronos Timeline", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-timeline",
      name: "Open timeline",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "open-timeline-today",
      name: "Open timeline (jump to today)",
      callback: () => {
        this.activateView().then(() => {
          this.getActiveView()?.jumpToToday();
        });
      },
    });

    this.addCommand({
      id: "zoom-in",
      name: "Zoom in",
      callback: () => this.getActiveView()?.zoomIn(),
    });

    this.addCommand({
      id: "zoom-out",
      name: "Zoom out",
      callback: () => this.getActiveView()?.zoomOut(),
    });

    this.addCommand({
      id: "toggle-heatmap",
      name: "Toggle heatmap / timeline view",
      callback: () => this.getActiveView()?.toggleViewMode(),
    });

    this.addCommand({
      id: "toggle-filters",
      name: "Toggle filter panel",
      callback: () => this.getActiveView()?.toggleFilterPanel(),
    });

    this.addSettingTab(new ChronosSettingTab(this.app, this));

    console.log("Chronos Timeline loaded.");
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
    console.log("Chronos Timeline unloaded.");
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    const existingLeaves = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
    if (existingLeaves.length > 0) {
      workspace.revealLeaf(existingLeaves[0]);
      return;
    }

    const leaf = workspace.getLeaf("tab");
    await leaf.setViewState({ type: TIMELINE_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }

  private getActiveView(): TimelineView | null {
    const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
    if (leaves.length === 0) return null;
    const view = leaves[0].view;
    return view instanceof TimelineView ? view : null;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
      if (leaf.view instanceof TimelineView) {
        (leaf.view as TimelineView).updateSettings(this.settings);
      }
    });
  }
}
