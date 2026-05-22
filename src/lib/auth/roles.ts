export const userRoles = {
  admin: "ADMIN",
  staff: "STAFF",
} as const;

export type UserRole = (typeof userRoles)[keyof typeof userRoles];

export function normalizeUserRole(role: string | null | undefined): UserRole {
  return role?.trim().toUpperCase() === userRoles.admin ? userRoles.admin : userRoles.staff;
}

export function isAdminRole(role: string | null | undefined) {
  return normalizeUserRole(role) === userRoles.admin;
}
