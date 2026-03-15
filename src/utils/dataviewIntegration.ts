import { App, TFile } from "obsidian";

/** Returns the Dataview API object if the plugin is loaded, otherwise null. */
export function getDataviewApi(app: App): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (app as any).plugins?.plugins?.["dataview"]?.api ?? null;
}

/**
 * Uses Dataview to resolve a query string into a list of TFile objects.
 * Falls back to the full vault file list on any error.
 */
export function resolveFilesFromDataview(
  app: App,
  dvApi: unknown,
  query: string
): TFile[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = (dvApi as any).pages(query);
    const files: TFile[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const page of pages.values) {
      const f = app.vault.getAbstractFileByPath(page.file.path);
      if (f instanceof TFile) files.push(f);
    }
    return files;
  } catch {
    return app.vault.getMarkdownFiles();
  }
}

/** Returns true if the Dataview plugin is installed and enabled. */
export function isDataviewAvailable(app: App): boolean {
  return getDataviewApi(app) !== null;
}
