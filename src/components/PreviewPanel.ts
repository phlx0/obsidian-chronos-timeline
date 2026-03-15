import { App, Component, MarkdownRenderer, TFile } from "obsidian";

/**
 * Side panel that renders the selected note's content using Obsidian's
 * native MarkdownRenderer, so links and embeds work correctly.
 */
export class PreviewPanel extends Component {
  private containerEl: HTMLElement;
  private titleEl: HTMLElement;
  private contentEl: HTMLElement;

  constructor(parent: HTMLElement) {
    super();
    this.containerEl = parent.createDiv({ cls: "chronos-preview-panel" });

    const header = this.containerEl.createDiv({ cls: "chronos-preview-header" });
    this.titleEl = header.createDiv({ cls: "chronos-preview-title", text: "Preview" });

    this.contentEl = this.containerEl.createDiv({ cls: "chronos-preview-content markdown-rendered" });
    this.showEmpty();
  }

  async showNote(app: App, path: string): Promise<void> {
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;

    this.titleEl.textContent = file.basename;
    this.contentEl.empty();

    try {
      const content = await app.vault.cachedRead(file);
      await MarkdownRenderer.render(app, content, this.contentEl, path, this);
    } catch {
      this.contentEl.createDiv({ cls: "chronos-preview-empty", text: "Could not render preview." });
    }
  }

  showEmpty(): void {
    this.titleEl.textContent = "Preview";
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: "chronos-preview-empty",
      text: "Click a note card to preview it here.",
    });
  }

  getContainer(): HTMLElement {
    return this.containerEl;
  }
}
