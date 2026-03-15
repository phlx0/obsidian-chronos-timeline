import { TimelineNote, ZOOM_PX_PER_DAY, ZoomLevel } from "../types";

export class Minimap {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private vpIndicator: HTMLElement;
  private onJump: (scrollX: number) => void;
  private resizeObserver: ResizeObserver;

  private notes: TimelineNote[] = [];
  private viewStartDate: Date = new Date();
  private zoom: ZoomLevel = "month";
  private totalWidth = 0;
  private lastScrollLeft = 0;
  private lastViewportWidth = 0;
  private selectedNotePath: string | null = null;

  constructor(parent: HTMLElement, onJump: (scrollX: number) => void) {
    this.onJump = onJump;

    this.container = parent.createDiv({ cls: "chronos-minimap" });
    this.canvas = this.container.createEl("canvas", { cls: "chronos-minimap-canvas" });
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas 2D context");
    this.ctx = ctx;

    this.vpIndicator = this.container.createDiv({ cls: "chronos-minimap-viewport" });

    this.container.addEventListener("click", (evt) => {
      if (this.totalWidth === 0) return;
      const rect = this.container.getBoundingClientRect();
      const ratio = (evt.clientX - rect.left) / rect.width;
      this.onJump(ratio * this.totalWidth);
    });

    // Re-draw whenever the container is resized (fixes zero-size on first open)
    this.resizeObserver = new ResizeObserver(() => {
      if (this.notes.length > 0) {
        this.draw(this.lastScrollLeft, this.lastViewportWidth);
      }
    });
    this.resizeObserver.observe(this.container);
  }

  update(
    notes: TimelineNote[],
    viewStartDate: Date,
    zoom: ZoomLevel,
    totalWidth: number,
    scrollLeft: number,
    viewportWidth: number
  ): void {
    this.notes = notes;
    this.viewStartDate = viewStartDate;
    this.zoom = zoom;
    this.totalWidth = totalWidth;
    this.lastScrollLeft = scrollLeft;
    this.lastViewportWidth = viewportWidth;
    this.draw(scrollLeft, viewportWidth);
  }

  private draw(scrollLeft: number, viewportWidth: number): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0 || this.totalWidth === 0) return;

    this.canvas.width = w;
    this.canvas.height = h;

    const pxPerDay = ZOOM_PX_PER_DAY[this.zoom];
    const scale = w / this.totalWidth;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    for (const note of this.notes) {
      const offsetDays = (note.date.getTime() - this.viewStartDate.getTime()) / 86_400_000;
      const noteX = offsetDays * pxPerDay * scale;
      const laneY = h * 0.4 + (note.laneIndex % 4) * 5;
      const isSelected = note.path === this.selectedNotePath;

      ctx.beginPath();
      ctx.arc(noteX, laneY, isSelected ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = note.color;
      ctx.globalAlpha = isSelected ? 1 : 0.8;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Viewport indicator
    const vpLeft = (scrollLeft / this.totalWidth) * w;
    const vpWidth = Math.max((viewportWidth / this.totalWidth) * w, 16);
    this.vpIndicator.style.left = `${vpLeft}px`;
    this.vpIndicator.style.width = `${vpWidth}px`;
  }

  setSelectedNote(path: string | null): void {
    this.selectedNotePath = path;
    if (this.notes.length > 0) {
      this.draw(this.lastScrollLeft, this.lastViewportWidth);
    }
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }

  getContainer(): HTMLElement {
    return this.container;
  }
}
