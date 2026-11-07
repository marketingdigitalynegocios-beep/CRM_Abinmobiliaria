"use client";

import { useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useRouter } from "next/navigation";
import { KanbanColumn } from "./KanbanColumn";
import type { DealCardData } from "./DealCard";

const STAGES: { id: string; label: string; dotColor: string }[] = [
  { id: "new", label: "Nuevo / Lead", dotColor: "bg-blue-500" },
  { id: "meeting_scheduled", label: "Visita Agendada", dotColor: "bg-amber-500" },
  { id: "qualified", label: "Calificado / Interesado", dotColor: "bg-sky-500" },
  { id: "proposal_sent", label: "Propuesta / Estudio", dotColor: "bg-purple-500" },
  { id: "negotiation", label: "Negociación", dotColor: "bg-indigo-500" },
  { id: "closed_won", label: "Cerrado Ganado", dotColor: "bg-emerald-500" },
  { id: "closed_lost", label: "Cerrado Perdido", dotColor: "bg-rose-400" },
];

export function KanbanBoard({ deals }: { deals: (DealCardData & { stage: string })[] }) {
  const router = useRouter();
  const [columns, setColumns] = useState(() => {
    const grouped: Record<string, (DealCardData & { stage: string })[]> = {};
    for (const stage of STAGES) grouped[stage.id] = [];
    for (const deal of deals) {
      if (!grouped[deal.stage]) grouped[deal.stage] = [];
      grouped[deal.stage].push(deal);
    }
    return grouped;
  });

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return;
    }

    setColumns((prev) => {
      const next = { ...prev };
      const sourceList = [...(next[source.droppableId] || [])];
      const [moved] = sourceList.splice(source.index, 1);
      if (!moved) return prev;
      const destList = [...(next[destination.droppableId] || [])];
      destList.splice(destination.index, 0, { ...moved, stage: destination.droppableId });
      next[source.droppableId] = sourceList;
      next[destination.droppableId] = destList;
      return next;
    });

    try {
      await fetch(`/api/deals/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: destination.droppableId }),
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to update deal stage", err);
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 select-none">
        {STAGES.map((stage) => (
          <KanbanColumn
            deals={columns[stage.id] ?? []}
            dotColor={stage.dotColor}
            key={stage.id}
            label={stage.label}
            stage={stage.id}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
