import { TimelineNote } from "../types";

const CELL = 13;
const GAP = 2;
const STEP = CELL + GAP;
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type DayKey = string; // "YYYY-MM-DD"

function toKey(d: Date): DayKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeekMonday(d: Date): Date {
  const out = new Date(d);
  const dow = (out.getDay() + 6) % 7; // Mon=0 … Sun=6
  out.setDate(out.getDate() - dow);
  out.setHours(0, 0, 0, 0);
  return out;
}

export class HeatmapRenderer {
  private container: HTMLElement;
  private onDayClick: (date: Date, notes: TimelineNote[]) => void;

  constructor(
    parent: HTMLElement,
    onDayClick: (date: Date, notes: TimelineNote[]) => void
  ) {
    this.onDayClick = onDayClick;
    this.container = parent.createDiv({ cls: "chronos-heatmap-wrapper" });
  }

  render(notes: TimelineNote[]): void {
    this.container.empty();

    if (notes.length === 0) {
      this.container.createDiv({ cls: "chronos-empty-state", text: "No dated notes found." });
      return;
    }

    const byDay = new Map<DayKey, TimelineNote[]>();
    let minYear = Infinity;
    let maxYear = -Infinity;

    for (const note of notes) {
      const key = toKey(note.date);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(note);
      const y = note.date.getFullYear();
      if (y < minYear) minYear = y;
      if (y > maxYear) maxYear = y;
    }

    const maxCount = Math.max(...[...byDay.values()].map((n) => n.length));

    for (let year = maxYear; year >= minYear; year--) {
      this.renderYear(year, byDay, maxCount);
    }
  }

  private renderYear(
    year: number,
    byDay: Map<DayKey, TimelineNote[]>,
    maxCount: number
  ): void {
    const section = this.container.createDiv({ cls: "chronos-heatmap-year-section" });
    section.createEl("h3", { cls: "chronos-heatmap-year-label", text: String(year) });

    const grid = section.createDiv({ cls: "chronos-heatmap-grid-wrap" });

    // Day-of-week label column
    const dayLabelCol = grid.createDiv({ cls: "chronos-heatmap-day-labels" });
    DAY_LABELS.forEach((label) => {
      dayLabelCol.createDiv({ cls: "chronos-heatmap-day-label", text: label });
    });

    const weeksWrap = grid.createDiv({ cls: "chronos-heatmap-weeks-wrap" });

    // Month labels row (inside weeks wrap as an overlay row)
    const monthLabelRow = weeksWrap.createDiv({ cls: "chronos-heatmap-month-row" });

    const weeksContainer = weeksWrap.createDiv({ cls: "chronos-heatmap-weeks" });

    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);

    // Start from Monday of the week containing Jan 1
    let cur = startOfWeekMonday(jan1);
    let weekIndex = 0;
    let lastMonth = -1;

    while (cur <= dec31) {
      const weekEl = weeksContainer.createDiv({ cls: "chronos-heatmap-week" });

      // Detect month change in this week → place month label
      for (let d = 0; d < 7; d++) {
        const day = new Date(cur);
        day.setDate(day.getDate() + d);
        if (day.getFullYear() === year && day.getMonth() !== lastMonth) {
          lastMonth = day.getMonth();
          const lbl = monthLabelRow.createDiv({ cls: "chronos-heatmap-month-label" });
          lbl.style.width = `${STEP}px`;
          lbl.style.marginLeft = weekIndex === 0 ? "0" : "0";
          lbl.textContent = MONTH_NAMES[lastMonth];
          // Position month label under this week column
          lbl.style.gridColumn = String(weekIndex + 1);
        }
      }

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const day = new Date(cur);
        day.setDate(day.getDate() + dayOfWeek);

        const cell = weekEl.createDiv({ cls: "chronos-heatmap-cell" });
        cell.style.width = `${CELL}px`;
        cell.style.height = `${CELL}px`;

        const isThisYear = day.getFullYear() === year;
        if (!isThisYear) {
          cell.addClass("chronos-heatmap-cell-empty");
        } else {
          const key = toKey(day);
          const dayNotes = byDay.get(key) ?? [];
          const count = dayNotes.length;

          if (count === 0) {
            cell.addClass("chronos-heatmap-cell-zero");
          } else {
            const intensity = Math.ceil((count / maxCount) * 4);
            cell.addClass("chronos-heatmap-cell-active");
            cell.dataset.intensity = String(Math.min(intensity, 4));
            cell.title = `${toKey(day)}: ${count} note${count !== 1 ? "s" : ""}`;

            cell.addEventListener("click", () => {
              this.onDayClick(new Date(day), dayNotes);
            });

            cell.addEventListener("mouseenter", (evt) => {
              showTooltip(cell, `${toKey(day)} — ${count} note${count !== 1 ? "s" : ""}`);
            });
          }
        }
      }

      cur.setDate(cur.getDate() + 7);
      weekIndex++;
      if (cur.getFullYear() > year && cur.getMonth() > 0) break;
    }
  }

  getContainer(): HTMLElement {
    return this.container;
  }
}

// Lightweight tooltip — no library dependency
function showTooltip(anchor: HTMLElement, text: string): void {
  const tip = document.createElement("div");
  tip.className = "chronos-heatmap-tooltip";
  tip.textContent = text;
  document.body.appendChild(tip);

  const rect = anchor.getBoundingClientRect();
  tip.style.left = `${rect.left + rect.width / 2 - tip.offsetWidth / 2}px`;
  tip.style.top = `${rect.top - tip.offsetHeight - 6}px`;

  const remove = () => { tip.remove(); anchor.removeEventListener("mouseleave", remove); };
  anchor.addEventListener("mouseleave", remove, { once: true });
}
