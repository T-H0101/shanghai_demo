"use client"

import type { RackSlot } from "@/lib/types/rack"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface SlotGridProps {
  slots: RackSlot[]
  columns?: number
}

export function SlotGrid({ slots, columns = 8 }: SlotGridProps) {
  return (
    <TooltipProvider>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {slots.map((slot) => (
          <Tooltip key={slot.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "aspect-square rounded text-xs font-medium transition-colors",
                  slot.occupied
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200"
                )}
              >
                {slot.index}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{slot.occupied ? slot.discNo ?? "已占用" : "空闲"}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
