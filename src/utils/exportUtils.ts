import { TimelineNote, ZoomLevel, ZOOM_PX_PER_DAY, LANE_HEIGHT_PX, CARD_HEIGHT_PX } from "../types";

const AXIS_H = 48;
const MAX_CANVAS_W = 4096;

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Draws a rounded rectangle path (does not fill/stroke). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  const safeR = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeR, y);
  ctx.lineTo(x + w - safeR, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + safeR);
  ctx.lineTo(x + w, y + h - safeR);
  ctx.quadraticCurveTo(x + w, y + h, x + w - safeR, y + h);
  ctx.lineTo(x + safeR, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - safeR);
  ctx.lineTo(x, y + safeR);
  ctx.quadraticCurveTo(x, y, x + safeR, y);
  ctx.closePath();
}

function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + "…";
}

/**
 * Exports the current timeline state as a PNG file download.
 * Renders a simplified but clean canvas version of the timeline.
 */
export function exportTimelineAsPng(
  notes: TimelineNote[],
  viewStartDate: Date,
  zoom: ZoomLevel,
  totalWidth: number,
  trackHeight: number,
  cardWidthPx: number,
  isDark: boolean
): void {
  const canvasW = Math.min(totalWidth, MAX_CANVAS_W);
  const canvasH = AXIS_H + trackHeight;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;

  // ── Background ──
  ctx.fillStyle = isDark ? "#1e1e2e" : "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // ── Axis bar ──
  ctx.fillStyle = isDark ? "#252535" : "#f5f5f8";
  ctx.fillRect(0, 0, canvasW, AXIS_H);

  const pxPerDay = ZOOM_PX_PER_DAY[zoom];

  // ── Axis labels ──
  ctx.fillStyle = isDark ? "#aaa" : "#555";
  ctx.font = "11px sans-serif";

  if (zoom === "year" || zoom === "month") {
    let cur = new Date(viewStartDate.getFullYear(), 0, 1);
    const end = new Date(viewStartDate.getTime() + (canvasW / pxPerDay) * 86_400_000);
    while (cur <= end) {
      const x = ((cur.getTime() - viewStartDate.getTime()) / 86_400_000) * pxPerDay;
      if (x >= 0 && x < canvasW) {
        ctx.fillStyle = isDark ? "#ccc" : "#333";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(String(cur.getFullYear()), x + 3, 20);
      }
      cur = new Date(cur.getFullYear() + 1, 0, 1);
    }
  }

  if (zoom === "month" || zoom === "week") {
    let cur = new Date(viewStartDate.getFullYear(), viewStartDate.getMonth(), 1);
    const end = new Date(viewStartDate.getTime() + (canvasW / pxPerDay) * 86_400_000);
    while (cur <= end) {
      const x = ((cur.getTime() - viewStartDate.getTime()) / 86_400_000) * pxPerDay;
      if (x >= 0 && x < canvasW) {
        ctx.fillStyle = isDark ? "#aaa" : "#666";
        ctx.font = "10px sans-serif";
        ctx.fillText(MONTH_NAMES[cur.getMonth()], x + 3, 38);
        // Tick
        ctx.strokeStyle = isDark ? "#444" : "#ddd";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, AXIS_H);
        ctx.stroke();
      }
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  // ── Today line ──
  const todayOffset = (Date.now() - viewStartDate.getTime()) / 86_400_000;
  const todayX = todayOffset * pxPerDay;
  if (todayX >= 0 && todayX <= canvasW) {
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(todayX, AXIS_H);
    ctx.lineTo(todayX, canvasH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Note cards ──
  for (const note of notes) {
    const offsetDays = (note.date.getTime() - viewStartDate.getTime()) / 86_400_000;
    const x = offsetDays * pxPerDay;
    const cardW = note.endDate
      ? Math.max(((note.endDate.getTime() - note.date.getTime()) / 86_400_000) * pxPerDay, cardWidthPx)
      : cardWidthPx;

    if (x + cardW < 0 || x > canvasW) continue;

    const y = AXIS_H + note.laneIndex * LANE_HEIGHT_PX + 8;

    // Card background
    ctx.fillStyle = isDark ? "#2a2a3e" : "#f0f0f5";
    roundRect(ctx, x, y, cardW, CARD_HEIGHT_PX, 6);
    ctx.fill();

    // Accent bar
    ctx.fillStyle = note.color + (note.isRecurring ? "88" : "");
    roundRect(ctx, x, y, 4, CARD_HEIGHT_PX, 3);
    ctx.fill();

    // Title
    ctx.fillStyle = isDark ? "#e0e0e0" : "#222";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(truncate(note.title, Math.floor(cardW / 7)), x + 10, y + 20);

    // Date
    ctx.fillStyle = isDark ? "#888" : "#777";
    ctx.font = "9px sans-serif";
    ctx.fillText(note.date.toLocaleDateString(), x + 10, y + 34);
  }

  // ── Download ──
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chronos-timeline-${new Date().toISOString().split("T")[0]}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
