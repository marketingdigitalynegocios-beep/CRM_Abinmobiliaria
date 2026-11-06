import { Draggable, Droppable } from "@hello-pangea/dnd";
import { DealCard, type DealCardData } from "./DealCard";

export function KanbanColumn({
  stage,
  label,
  deals,
}: {
  stage: string;
  label: string;
  deals: DealCardData[];
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col rounded-md bg-light-gray">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray">
        {label} <span className="text-gray/70">({deals.length})</span>
      </div>
      <Droppable droppableId={stage}>
        {(provided) => (
          <div
            className="flex min-h-[80px] flex-1 flex-col gap-2 p-2"
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
          </div>
        )}
      </Droppable>
    </div>
  );
}
