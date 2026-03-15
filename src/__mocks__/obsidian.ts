// Minimal Obsidian API mock for unit tests
export class TFile {
  path = "";
  basename = "";
  parent = null;
  stat = { ctime: 0, mtime: 0, size: 0 };
}

export class Plugin {}
export class ItemView {}
export class WorkspaceLeaf {}
export class Modal {}
export class Notice { constructor(_msg: string) {} }
export class Component {
  addChild<T extends Component>(child: T): T { return child; }
  load() {}
  unload() {}
  onload() {}
  onunload() {}
}
export class MarkdownRenderer {
  static async render() {}
}
export class Setting {}
export class PluginSettingTab {}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, wait = 0): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  }) as T;
}

export const App = class {};
export const Vault = class {};
