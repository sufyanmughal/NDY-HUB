"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { NewEventModal, EditEventModal } from "@/components/ndyspace/quick-action-modals";
import { listCalendarEvents, deleteCalendarEvent, type CalendarEvent } from "@/lib/ndyspace-api";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NdyspaceCalendarPage() {
  const { auth } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  function load() {
    if (auth.status !== "authenticated") return;
    // Full weeks spanning the visible month, matching what the grid below
    // actually renders (leading/trailing days from adjacent months).
    const firstOfMonth = new Date(year, month, 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - ((firstOfMonth.getDay() + 6) % 7));
    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridEnd.getDate() + 42);
    listCalendarEvents(gridStart.toISOString(), gridEnd.toISOString())
      .then(setEvents)
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    // Deferred rather than called synchronously in the effect body — see
    // ndyspace-hooks.ts's useAuthedPoll for the same microtask-hop pattern.
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setEvents(null);
    });
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, year, month]);

  if (auth.status !== "authenticated") return null;

  const firstOfMonth = new Date(year, month, 1);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = leadingBlanks - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }

  const eventsByDay = new Map<string, CalendarEvent[]>();
  events?.forEach((ev) => {
    const key = dateKey(new Date(ev.startAt));
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), ev]);
  });

  const selectedDayEvents = eventsByDay.get(dateKey(selectedDay)) ?? [];

  async function handleDelete(id: string) {
    await deleteCalendarEvent(id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Non-recurring events for this pass — recurrence and attendee invites are a follow-up.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          New Event
        </button>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {MONTH_LABELS[month]} {year}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (month === 0) {
                    setMonth(11);
                    setYear((y) => y - 1);
                  } else setMonth((m) => m - 1);
                }}
                className="rounded p-1 text-foreground-muted hover:bg-surface-2"
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
              <button
                onClick={() => {
                  setYear(today.getFullYear());
                  setMonth(today.getMonth());
                  setSelectedDay(today);
                }}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
              >
                Today
              </button>
              <button
                onClick={() => {
                  if (month === 11) {
                    setMonth(0);
                    setYear((y) => y + 1);
                  } else setMonth((m) => m + 1);
                }}
                className="rounded p-1 text-foreground-muted hover:bg-surface-2"
              >
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-foreground-muted">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map(({ date, inMonth }, idx) => {
              const key = dateKey(date);
              const dayEvents = eventsByDay.get(key) ?? [];
              const isToday = key === dateKey(today);
              const isSelected = key === dateKey(selectedDay);
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(date)}
                  className={`flex h-16 flex-col items-start rounded-md border p-1 text-left text-xs ${
                    isSelected ? "border-accent" : "border-transparent"
                  } ${inMonth ? "" : "opacity-40"} hover:bg-surface-2`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      isToday ? "bg-accent text-white font-semibold" : ""
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: ev.color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium">
            {selectedDay.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h2>
          <div className="mt-3 space-y-2">
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-foreground-muted">No events on this day.</p>
            ) : (
              selectedDayEvents
                .sort((a, b) => a.startAt.localeCompare(b.startAt))
                .map((ev) => (
                  <div key={ev.id} className="flex gap-2 rounded-md border border-border p-2">
                    <span
                      className="w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: ev.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{ev.title}</p>
                      <p className="text-xs text-foreground-muted">
                        {new Date(ev.startAt).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {" – "}
                        {new Date(ev.endAt).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      {ev.description && (
                        <p className="mt-1 text-xs text-foreground-muted">{ev.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-start gap-2">
                      <button
                        onClick={() => setEditingEvent(ev)}
                        aria-label="Edit event"
                        className="text-foreground-muted hover:text-accent"
                      >
                        <Pencil size={14} strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        aria-label="Delete event"
                        className="text-foreground-muted hover:text-critical"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {createOpen && <NewEventModal onClose={() => setCreateOpen(false)} onCreated={load} />}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
