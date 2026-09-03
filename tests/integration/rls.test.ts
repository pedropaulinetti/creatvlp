/**
 * Teste de isolamento entre workspaces.
 * Cria dois usuários reais, cada um no seu workspace, e verifica que nenhum
 * consegue alcançar os dados do outro — nem trocando IDs na consulta.
 *
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no ambiente. Sem ela, é pulado.
 * Nunca comite essa chave: leia do ambiente na hora de rodar.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const enabled = Boolean(url && serviceKey && anonKey);

type Actor = {
  id: string;
  email: string;
  client: SupabaseClient;
  workspaceId: string;
  brandId: string;
};

const password = "SenhaDeTeste123";
const suffix = Math.random().toString(36).slice(2, 8);

describe.skipIf(!enabled)("RLS entre workspaces diferentes", () => {
  let admin: SupabaseClient;
  let alice: Actor;
  let bob: Actor;

  async function createActor(label: string): Promise<Actor> {
    const email = `rls-${label}-${suffix}@creatvos.test`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Teste ${label}` },
    });
    if (createError || !created.user) throw createError ?? new Error("falha ao criar usuário");

    const client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    // O gatilho de cadastro já criou perfil, workspace e membership.
    const { data: membership, error: membershipError } = await client
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", created.user.id)
      .single();
    if (membershipError) throw membershipError;

    const { data: brand, error: brandError } = await client
      .from("brands")
      .insert({
        workspace_id: membership.workspace_id,
        name: `Marca de ${label}`,
        created_by: created.user.id,
      })
      .select("id")
      .single();
    if (brandError) throw brandError;

    return {
      id: created.user.id,
      email,
      client,
      workspaceId: membership.workspace_id,
      brandId: brand.id,
    };
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    alice = await createActor("alice");
    bob = await createActor("bob");
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    for (const actor of [alice, bob]) {
      if (actor?.id) await admin.auth.admin.deleteUser(actor.id).catch(() => undefined);
    }
  }, 30_000);

  it("provisiona um workspace próprio para cada usuário", () => {
    expect(alice.workspaceId).toBeTruthy();
    expect(bob.workspaceId).toBeTruthy();
    expect(alice.workspaceId).not.toBe(bob.workspaceId);
  });

  it("cada um enxerga apenas a própria marca", async () => {
    const { data } = await alice.client.from("brands").select("id, name");
    expect(data?.map((row) => row.id)).toEqual([alice.brandId]);

    const { data: bobBrands } = await bob.client.from("brands").select("id, name");
    expect(bobBrands?.map((row) => row.id)).toEqual([bob.brandId]);
  });

  it("não devolve a marca do outro nem consultando o ID direto", async () => {
    const { data } = await bob.client.from("brands").select("*").eq("id", alice.brandId);
    expect(data).toEqual([]);
  });

  it("não deixa escrever no workspace do outro", async () => {
    const { error } = await bob.client.from("brands").insert({
      workspace_id: alice.workspaceId,
      name: "Invasão",
    });
    expect(error).toBeTruthy();
    expect(error?.message.toLowerCase()).toContain("row-level security");
  });

  it("não deixa alterar a marca do outro", async () => {
    const { data } = await bob.client
      .from("brands")
      .update({ name: "Renomeada por outro" })
      .eq("id", alice.brandId)
      .select("id");
    expect(data ?? []).toEqual([]);

    const { data: check } = await alice.client.from("brands").select("name").eq("id", alice.brandId).single();
    expect(check?.name).toBe("Marca de alice");
  });

  it("não deixa apagar a marca do outro", async () => {
    const { data } = await bob.client.from("brands").delete().eq("id", alice.brandId).select("id");
    expect(data ?? []).toEqual([]);
  });

  it("não expõe campanhas de outro workspace", async () => {
    const { data: campaign } = await alice.client
      .from("campaigns")
      .insert({
        workspace_id: alice.workspaceId,
        brand_id: alice.brandId,
        name: "Campanha da Alice",
        created_by: alice.id,
      })
      .select("id")
      .single();

    const { data: seenByBob } = await bob.client.from("campaigns").select("id").eq("id", campaign!.id);
    expect(seenByBob).toEqual([]);
  });

  it("não deixa ler arquivos do bucket do outro workspace", async () => {
    const { data } = await bob.client.storage.from("brand-assets").list(alice.workspaceId);
    expect(data ?? []).toEqual([]);
  });

  it("não expõe a quota de outro workspace", async () => {
    const { data } = await bob.client.from("usage_quotas").select("*").eq("workspace_id", alice.workspaceId);
    expect(data).toEqual([]);
  });

  it("mantém o consumo de IA fora do alcance de escrita do cliente", async () => {
    const { error } = await bob.client.from("ai_usage_events").insert({
      workspace_id: bob.workspaceId,
      kind: "imagem",
      model: "falso",
      cost_usd: 0,
    });
    expect(error).toBeTruthy();
  });

  it("não deixa usuário comum virar administrador da plataforma", async () => {
    await bob.client.from("profiles").update({ platform_role: "admin" }).eq("id", bob.id);
    const { data } = await bob.client.from("profiles").select("platform_role").eq("id", bob.id).single();
    expect(data?.platform_role).toBe("user");
  });

  it("não deixa usuário comum ler as respostas da pesquisa", async () => {
    const { data } = await bob.client.from("research_responses").select("id").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("não deixa workspace órfão para trás quando o último membro sai", async () => {
    const carol = await createActor("carol");
    const { workspaceId, brandId, id } = carol;

    await admin.auth.admin.deleteUser(id);

    const { data: workspace } = await admin.from("workspaces").select("id").eq("id", workspaceId);
    expect(workspace, "workspace sem membros deve ser removido").toEqual([]);

    const { data: brand } = await admin.from("brands").select("id").eq("id", brandId);
    expect(brand, "a marca deve sair junto com o workspace").toEqual([]);
  });
});
