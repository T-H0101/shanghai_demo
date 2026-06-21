"use client"

import { Checkbox } from "@/components/ui/checkbox"
import type { PermissionNode } from "@/lib/types/user"
import { cn } from "@/lib/utils"

interface PermissionTreeProps {
  nodes: PermissionNode[]
  onToggle?: (id: string) => void
  depth?: number
}

export function PermissionTree({ nodes, onToggle, depth = 0 }: PermissionTreeProps) {
  return (
    <ul className={cn("space-y-1", depth > 0 && "ml-4 border-l border-slate-200 dark:border-slate-700 pl-3")}>
      {nodes.map((node) => (
        <li key={node.id}>
          <label className="flex items-center gap-2 py-1 text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100">
            <Checkbox checked={node.checked} onCheckedChange={() => onToggle?.(node.id)} />
            <span>{node.label}</span>
          </label>
          {node.children && node.children.length > 0 && (
            <PermissionTree nodes={node.children} onToggle={onToggle} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  )
}
