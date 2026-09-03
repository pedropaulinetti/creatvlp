/**
 * Capacidades da interface. É só para esconder o que não faz sentido mostrar —
 * o bloqueio real é a RLS no banco e a verificação nas Edge Functions.
 */
export type MemberRole = "owner" | "admin" | "member";
export type PlatformRole = "user" | "admin";

export function isWorkspaceAdmin(role: MemberRole | null): boolean {
  return role === "owner" || role === "admin";
}

export function canRenameWorkspace(role: MemberRole | null): boolean {
  return isWorkspaceAdmin(role);
}

export function canManageMembers(role: MemberRole | null): boolean {
  return isWorkspaceAdmin(role);
}

export function canDeleteContent(role: MemberRole | null): boolean {
  return isWorkspaceAdmin(role);
}

export function canAccessAdmin(platformRole: PlatformRole | null | undefined): boolean {
  return platformRole === "admin";
}

export function canAddBrand(current: number, brandsLimit: number): boolean {
  return current < brandsLimit;
}

export function canInviteMember(current: number, membersLimit: number): boolean {
  return current < membersLimit;
}

/** Rotina só pode gerar imagem sozinha se a geração automática estiver ligada. */
export function canEnableImageGeneration(autoGenerate: boolean): boolean {
  return autoGenerate;
}

export function canRunRoutineAutomatically(planAllowsAutoRoutines: boolean, autoGenerate: boolean): boolean {
  return autoGenerate && planAllowsAutoRoutines;
}
