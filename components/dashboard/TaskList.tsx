"use client";

import { useEffect, useState } from "react";

interface TaskItem {
  id: string;
  title: string;
  dueAt: string | null;
  status: "pending" | "done";
  leadId: string | null;
  dealId: string | null;
}

export function TaskList({
  leadId,
  dealId,
  emptyLabel = "Sin tareas pendientes.",
}: {
  leadId?: string;
  dealId?: string;
  emptyLabel?: string;
}) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (leadId) params.set("leadId", leadId);
    if (dealId) params.set("dealId", dealId);
    params.set("status", "pending");

    const res = await fetch(`/api/tasks?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { tasks: TaskItem[] };
      setTasks(data.tasks);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, dealId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          leadId,
          dealId,
          dueAt: newDueAt ? new Date(newDueAt).toISOString() : undefined,
        }),
      });
      setNewTitle("");
      setNewDueAt("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
  }

  const now = Date.now();

  if (loading) return <p className="text-sm text-gray">Cargando tareas...</p>;

  return (
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <p className="text-sm text-gray">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => {
            const overdue = task.dueAt && new Date(task.dueAt).getTime() < now;
            return (
              <li
                key={task.id}
                className={`flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm ${
                  overdue ? "border-danger/40 bg-red-50" : "border-border bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-dark">{task.title}</p>
                  {task.dueAt && (
                    <p className={`text-[11px] ${overdue ? "text-danger font-semibold" : "text-gray"}`}>
                      {new Date(task.dueAt).toLocaleString("es-CO")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleComplete(task.id)}
                  className="shrink-0 rounded border border-border px-2 py-1 text-[11px] font-medium text-gray hover:bg-light-gray hover:text-dark transition-colors"
                  title="Marcar como hecha"
                >
                  Hecho
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nueva tarea..."
          className="flex-1 h-8 rounded-md border border-border px-2.5 text-xs text-dark focus:border-primary focus:outline-none"
        />
        <input
          type="datetime-local"
          value={newDueAt}
          onChange={(e) => setNewDueAt(e.target.value)}
          className="h-8 rounded-md border border-border px-2 text-xs text-dark focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || !newTitle.trim()}
          className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-light disabled:opacity-50 transition-colors"
        >
          Agregar
        </button>
      </form>
    </div>
  );
}
