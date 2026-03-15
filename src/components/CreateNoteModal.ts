import { App, Modal, Setting, TFile, Notice } from "obsidian";
import { formatDateForFrontmatter } from "../utils/frontmatterEditor";
import { ChronosSettings } from "../types";

export class CreateNoteModal extends Modal {
  private date: Date;
  private settings: ChronosSettings;
  private onCreated: (file: TFile) => void;

  constructor(
    app: App,
    date: Date,
    settings: ChronosSettings,
    onCreated: (file: TFile) => void
  ) {
    super(app);
    this.date = date;
    this.settings = settings;
    this.onCreated = onCreated;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Create note at date" });

    let title = "";
    let dateStr = formatDateForFrontmatter(this.date);

    new Setting(contentEl)
      .setName("Title")
      .addText((text) => {
        text.setPlaceholder("Note title…").onChange((v) => (title = v));
        // Focus after a tick so the modal has rendered
        setTimeout(() => text.inputEl.focus(), 50);
        text.inputEl.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter") this.create(title, dateStr);
        });
      });

    new Setting(contentEl)
      .setName("Date")
      .setDesc(`Will be written as frontmatter field: "${this.settings.dateFields[0] ?? "date"}"`)
      .addText((text) => {
        text.setValue(dateStr).onChange((v) => (dateStr = v));
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Create")
          .setCta()
          .onClick(() => this.create(title, dateStr))
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );
  }

  private async create(title: string, dateStr: string): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) {
      new Notice("Please enter a title.");
      return;
    }

    const field = this.settings.dateFields[0] ?? "date";
    const content = `---\n${field}: ${dateStr}\n---\n\n`;

    try {
      const file = await this.app.vault.create(`${trimmed}.md`, content);
      this.onCreated(file);
      this.close();
    } catch (e) {
      new Notice(`Could not create note: ${(e as Error).message}`);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
