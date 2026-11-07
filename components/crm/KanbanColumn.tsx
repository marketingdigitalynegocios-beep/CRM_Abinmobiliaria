import { Draggable, Droppable } from "@hello-pangea/dnd";
import { DealCard, type DealCardData } from "./DealCard";

export function KanbanColumn({
  stage,
  label,
  dotColor = "bg-primary",
  deals,
}: {
  stage: string;
  label: string;
  dotColor?: string;
  deals: DealCardData[];
}) {
  const totalVolumeCents = deals.reduce(
    (acc, d) => acc + (d.dealValueCents || 0),
    0
  );
  const totalVolumeCOP = Math.round(totalVolumeCents / 100);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-slate-50/70 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-white px-3.5 py-3 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <span className="text-xs font-semibold text-dark truncate">
            {label}
          </span>
          <span className="rounded-full bg-light-gray px-1.5 py-0.5 text-[10px] font-bold text-gray">
            {deals.length}
          </span>
        </div>
        {totalVolumeCOP > 0 && (
          <span className="text-[11px] font-semibold text-primary font-mono">
            {totalVolumeCOP >= 1000000000
              ? `$${(totalVolumeCOP / 1000000000).toFixed(1)}B COP`
              : totalVolumeCOP >= 1000000
              ? `$${(totalVolumeCOP / 1000000).toFixed(0)}M COP`
              : `$${totalVolumeCOP.toLocaleString("es-CO")} COP`}
          </span>
        )}
      </div>

      {/* Cards container */}
      <Droppable droppableId={stage}>
        {(provided) => (
          <div
            className="flex min-h-[160px] flex-1 flex-col gap-2.5 p-2.5 overflow-y-auto max-h-[calc(100vh-280px)]"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {deals.map((deal, index) => (
              <Draggable draggableId={deal.id} index={index} key={deal.id}>
                {(dragProvided) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                  >
                    <DealCard deal={deal} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {deals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-gray/60 border border-dashed border-border/80 rounded-lg m-1">
                <span className="material-symbols-outlined text-[24px] text-gray/40">
                  inbox
                </span>
                <span className="text-[11px] mt-1 font-medium">Sin oportunidades</span>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
