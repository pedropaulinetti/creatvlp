import { describe, expect, it } from "vitest";
import {
  canAccessAdmin, canAddBrand, canDeleteContent, canEnableImageGeneration,
  canInviteMember, canManageMembers, canRenameWorkspace, canRunRoutineAutomatically, isWorkspaceAdmin,
} from "@/lib/permissions";

describe("papéis no workspace", () => {
  it("owner e admin administram; member não", () => {
    expect(isWorkspaceAdmin("owner")).toBe(true);
    expect(isWorkspaceAdmin("admin")).toBe(true);
    expect(isWorkspaceAdmin("member")).toBe(false);
    expect(isWorkspaceAdmin(null)).toBe(false);
  });

  it("renomear, gerenciar pessoas e excluir exigem administração", () => {
    expect(canRenameWorkspace("member")).toBe(false);
    expect(canManageMembers("member")).toBe(false);
    expect(canDeleteContent("member")).toBe(false);
    expect(canDeleteContent("owner")).toBe(true);
  });
});

describe("acesso administrativo da plataforma", () => {
  it("só o papel admin entra", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("user")).toBe(false);
    expect(canAccessAdmin(null)).toBe(false);
    expect(canAccessAdmin(undefined)).toBe(false);
  });
});

describe("limites do plano", () => {
  it("bloqueia nova marca ao atingir o limite", () => {
    expect(canAddBrand(0, 1)).toBe(true);
    expect(canAddBrand(1, 1)).toBe(false);
    expect(canAddBrand(2, 3)).toBe(true);
  });

  it("bloqueia convite ao atingir o limite de pessoas", () => {
    expect(canInviteMember(1, 2)).toBe(true);
    expect(canInviteMember(2, 2)).toBe(false);
  });
});

describe("segurança das rotinas", () => {
  it("gerar imagem exige geração automática ligada", () => {
    expect(canEnableImageGeneration(false)).toBe(false);
    expect(canEnableImageGeneration(true)).toBe(true);
  });

  it("execução automática exige plano que permita", () => {
    expect(canRunRoutineAutomatically(false, true)).toBe(false);
    expect(canRunRoutineAutomatically(true, false)).toBe(false);
    expect(canRunRoutineAutomatically(true, true)).toBe(true);
  });
});
