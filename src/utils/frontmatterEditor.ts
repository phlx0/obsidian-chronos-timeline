import { App, TFile } from "obsidian";

export function formatDateForFrontmatter(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function updateNoteDate(
  app: App,
  file: TFile,
  field: string,
  newDate: Date
): Promise<void> {
  const dateStr = formatDateForFrontmatter(newDate);
  await app.fileManager.processFrontMatter(file, (fm) => {
    fm[field] = dateStr;
  });
}
