"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getMiniCalendarDates } from "@/lib/ndyspace-api";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** §2.6: month/year header with prev/next nav, full Mon–Sun grid, today
 * highlighted, dot indicators on dates with events — sharing CalendarEvent
 * as its data source via the overview service's mini-calendar endpoint. */
export function MiniCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
  const [eventDates, setEventDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getMiniCalendarDates(year, month)
      .then((result) => {
        if (!cancelled) setEventDates(new Set(result.dates));
      })
      .catch(() => {
        /* dots just don't render if this fails — not worth an error banner */
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  function goPrevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  // getUTCDay(): 0=Sun..6=Sat — shifted so Monday is column 0.
  const leadingBlanks = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (day: number) =>
    year === today.getFullYear() && month === today.getMonth() + 1 && day === today.getDate();

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {MONTH_LABELS[month - 1]} {year}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={goPrevMonth}
            aria-label="Previous month"
            className="rounded p-1 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <button
            onClick={goNextMonth}
            aria-label="Next month"
            className="rounded p-1 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-foreground-muted">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`blank-${idx}`} />;
          const hasEvent = eventDates.has(toDateKey(year, month, day));
          return (
            <div
              key={day}
              className={`relative flex h-7 items-center justify-center rounded-full text-xs ${
                isToday(day) ? "bg-accent text-white font-semibold" : "text-foreground"
              }`}
            >
              {day}
              {hasEvent && !isToday(day) && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
