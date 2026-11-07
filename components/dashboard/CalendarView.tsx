"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";

interface VisitItem {
  id: string;
  scheduledAt: string;
  status: "scheduled" | "completed" | "cancelled";
  leadName: string;
  propertyTitle: string;
  advisorName: string | null;
}

const statusColors: Record<VisitItem["status"], string> = {
  scheduled: "bg-primary",
  completed: "bg-emerald-500",
  cancelled: "bg-gray",
};

export function CalendarView({ visits }: { visits: VisitItem[] }) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const visitsByDay = useMemo(() => {
    const map = new Map<string, VisitItem[]>();
    for (const visit of visits) {
      const key = format(new Date(visit.scheduledAt), "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      existing.push(visit);
      map.set(key, existing);
    }
    return map;
  }, [visits]);

  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      const end = endOfWeek(cursor, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [mode, cursor]);

  function goPrev() {
    setCursor((c) => (mode === "month" ? subMonths(c, 1) : subWeeks(c, 1)));
  }
  function goNext() {
    setCursor((c) => (mode === "month" ? addMonths(c, 1) : addWeeks(c, 1)));
  }

  const selectedVisits = selectedDay
    ? visitsByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? []
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-border hover:bg-light-gray"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <h3 className="text-sm font-bold text-dark min-w-[160px] text-center">
            {format(cursor, mode === "month" ? "MMMM yyyy" : "'Semana del' d 'de' MMMM", {
              locale: es,
            })}
          </h3>
          <button
            type="button"
            onClick={goNext}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-border hover:bg-light-gray"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setMode("month")}
            className={`px-3 py-1.5 font-semibold ${mode === "month" ? "bg-primary text-white" : "bg-white text-dark hover:bg-light-gray"}`}
          >
            Mes
          </button>
          <button
            type="button"
            onClick={() => setMode("week")}
            className={`px-3 py-1.5 font-semibold ${mode === "week" ? "bg-primary text-white" : "bg-white text-dark hover:bg-light-gray"}`}
          >
            Semana
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray uppercase">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className={`grid grid-cols-7 gap-1 ${mode === "week" ? "" : ""}`}>
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayVisits = visitsByDay.get(key) ?? [];
          const inMonth = mode === "week" || isSameMonth(day, cursor);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`min-h-[72px] rounded-md border p-1.5 text-left transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-light-gray"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span
                className={`text-xs font-semibold ${isToday ? "rounded-full bg-primary px-1.5 py-0.5 text-white" : "text-dark"}`}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayVisits.slice(0, 2).map((v) => (
                  <div
                    key={v.id}
                    className={`truncate rounded px-1 py-0.5 text-[10px] font-medium text-white ${statusColors[v.status]}`}
                  >
                    {format(new Date(v.scheduledAt), "HH:mm")} {v.propertyTitle}
                  </div>
                ))}
                {dayVisits.length > 2 && (
                  <p className="text-[10px] text-gray">+{dayVisits.length - 2} más</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="rounded-lg border border-border bg-white p-4 space-y-2">
          <h4 className="text-sm font-bold text-dark">
            Visitas del {format(selectedDay, "d 'de' MMMM, yyyy", { locale: es })}
          </h4>
          {selectedVisits.length === 0 ? (
            <p className="text-sm text-gray">Sin visitas agendadas este día.</p>
          ) : (
            <ul className="space-y-2">
              {selectedVisits.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-dark">
                      {format(new Date(v.scheduledAt), "HH:mm")} — {v.propertyTitle}
                    </p>
                    <p className="text-xs text-gray">
                      {v.leadName} · {v.advisorName ?? "Sin asesor asignado"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${statusColors[v.status]}`}
                  >
                    {v.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
