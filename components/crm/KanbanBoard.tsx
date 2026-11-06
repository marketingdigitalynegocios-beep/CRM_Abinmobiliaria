"use client";

import { useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useRouter } from "next/navigation";
import { KanbanColumn } from "./KanbanColumn";
import type { DealCardData } from "./DealCard";

const STAGES: { id: string; label: string }[] = [
  { id: "new", label: "Nuevo" },
  { id: "meeting_scheduled", label: "Reunión agendada" },
  { id: "qualified", label: "Calificado" },
  { id: "proposal_sent", label: "Propuesta enviada" },
  { id: "negotiation", label: "Negociación" },
  { id: "closed_won", label: "Cerrado ganado" },
  { id: "closed_lost", label: "Cerrado perdido" },
];

export function KanbanBoard({ deals }: { deals: (DealCardData & { stage: string })[] }) {
  const router = useRouter();
  const [columns, setColumns] = useState(() => {
    const grouped: Record<string, (DealCardData & { stage: string })[]> = {};
    for (const stage of STAGES) grouped[stage.id] = [];
    for (const deal of deals) grouped[deal.stage]?.push(deal);
    return grouped;
  });

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    setColumns((prev) => {
      const next = { ...prev };
      const sourceList = [...next[source.droppableId]];
      const [moved] = sourceList.splice(source.index, 1);
      const destList = [...next[destination.droppableId]];
      destList.splice(destination.index, 0, { ...moved, stage: destination.droppableId });
      next[source.droppableId] = sourceList;
      next[destination.droppableId] = destList;
      return next;
    });

    await fetch(`/api/deals/${draggableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: destination.droppableId }),
    });
    router.refresh();
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <KanbanColumn deals={columns[stage.id] ?? []} key={stage.id} label={stage.label} stage={stage.id} />
        ))}
      </div>
    </DragDropContext>
  );
}
