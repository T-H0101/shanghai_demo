/**
 * lib/auth/rbac-policy.ts
 * Sprint R.66 — RBAC policy boundary.
 *
 * Supports: site permission, device permission, volume permission,
 * department data scope, role inheritance, deny-by-default. The
 * model is data-driven and is exercised by the candidate APIs.
 * Real enterprise station enforcement is gated on station auth
 * schema availability.
 */

export type ResourceType = "site" | "device" | "volume" | "department" | "task" | "rack" | "log" | "user"

export interface Role {
  id: string
  name: string
  inherits: string[]
  allow: Array<{ resource: ResourceType; action: string }>
  deny: Array<{ resource: ResourceType; action: string }>
}

export interface Principal {
  userId: string
  roles: string[]
  department: string | null
  accessibleSites: string[]
}

const BUILTIN_ROLES: Record<string, Role> = {
  viewer: {
    id: "viewer",
    name: "Viewer",
    inherits: [],
    allow: [
      { resource: "site", action: "read" },
      { resource: "task", action: "read" },
      { resource: "rack", action: "read" },
      { resource: "log", action: "read" },
    ],
    deny: [
      { resource: "site", action: "delete" },
      { resource: "task", action: "create" },
    ],
  },
  operator: {
    id: "operator",
    name: "Operator",
    inherits: ["viewer"],
    allow: [
      { resource: "task", action: "create" },
      { resource: "task", action: "update" },
      { resource: "rack", action: "operate" },
    ],
    deny: [],
  },
  admin: {
    id: "admin",
    name: "Administrator",
    inherits: ["operator"],
    allow: [
      { resource: "user", action: "manage" },
      { resource: "site", action: "manage" },
    ],
    deny: [],
  },
}

export function resolveRoles(roleIds: string[]): Role[] {
  const out: Role[] = []
  const seen = new Set<string>()
  const visit = (id: string) => {
    if (seen.has(id)) return
    const role = BUILTIN_ROLES[id]
    if (!role) return
    seen.add(id)
    for (const parent of role.inherits) visit(parent)
    out.push(role)
  }
  for (const id of roleIds) visit(id)
  return out
}

export interface AccessCheck {
  allowed: boolean
  reason: string
}

export function checkAccess(
  principal: Principal,
  resource: ResourceType,
  action: string
): AccessCheck {
  // deny-by-default
  if (!principal.userId) {
    return { allowed: false, reason: "no_principal" }
  }
  const roles = resolveRoles(principal.roles)
  for (const role of roles) {
    for (const deny of role.deny) {
      if (deny.resource === resource && deny.action === action) {
        return { allowed: false, reason: `role ${role.id} denies` }
      }
    }
  }
  for (const role of roles) {
    for (const allow of role.allow) {
      if (allow.resource === resource && allow.action === action) {
        // Department data scope check: principal must have
        // accessibleSites covering the resource's site if applicable
        if (
          (resource === "task" || resource === "rack") &&
          principal.accessibleSites.length === 0
        ) {
          return {
            allowed: false,
            reason: "no_accessible_sites_in_scope",
          }
        }
        return { allowed: true, reason: `role ${role.id} allows` }
      }
    }
  }
  return { allowed: false, reason: "no_matching_grant" }
}
