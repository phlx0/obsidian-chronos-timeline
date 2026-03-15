import { TimelineNote, ZOOM_PX_PER_DAY, ZoomLevel } from "../types";

export class Minimap {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private vpIndicator: HTMLElement;
  private onJump: (scrollX: number) => void;

  private notes: TimelineNote[] = [];
  private viewStartDate: Date = new Date();
  private zoom: ZoomLevel = "month";
  private totalWidth = 0;

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
      const laneY = h * 0.35 + (note.laneIndex % 4) * 5;

      ctx.beginPath();
      ctx.arc(noteX, laneY, 2, 0, Math.PI * 2);
      ctx.fillStyle = note.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Viewport indicator
    const vpLeft = (scrollLeft / this.totalWidth) * w;
    const vpWidth = Math.max((viewportWidth / this.totalWidth) * w, 16);
    this.vpIndicator.style.left = `${vpLeft}px`;
    this.vpIndicator.style.width = `${vpWidth}px`;
  }

  getContainer(): HTMLElement {
    return this.container;
  }
}
