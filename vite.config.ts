import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";
import { fileURLToPath, URL } from "node:url";

/*
 * Skew Protection da Vercel num SPA em Vite.
 *
 * A Vercel faz isso sozinha só para Next, SvelteKit, Qwik, Astro e Nuxt. Para os
 * outros, a documentação manda carimbar o id do deploy nas requisições. O carimbo
 * aqui vai na URL de cada arquivo gerado: a aba que abriu o index.html do deploy A
 * segue pedindo `/assets/HomePage-xxx.js?dpl=A`, e a Vercel entrega o arquivo
 * daquele deploy mesmo depois que o B subiu. É o que evita a tela de erro de quem
 * estava no meio do onboarding quando saiu deploy novo.
 *
 * As duas variáveis só existem quando a Skew Protection está ligada no projeto e
 * o acesso às variáveis de sistema está habilitado. Fora disso o build não muda.
 */
const idDoDeploy =
  process.env.VERCEL_SKEW_PROTECTION_ENABLED === "1"
    ? process.env.VERCEL_DEPLOYMENT_ID
    : undefined;

/**
 * O `renderBuiltUrl` carimba o que o Vite escreve: as tags do index.html e a lista
 * de pré-carga. Não alcança o `import("./HomePage-xxx.js")` nem os imports entre
 * os pedaços do bundle, que o Rollup escreve em caminho relativo. Sem carimbo ali,
 * o arquivo da página sairia sem `dpl`, cairia no deploy mais recente e quebraria
 * do mesmo jeito. Pior: seria baixado duas vezes, já que a pré-carga apontava para
 * outra URL.
 *
 * Aqui o carimbo entra em todo caminho relativo que aponta para um arquivo do
 * próprio bundle, e só neles.
 */
const carimboNosImports = (id: string): Plugin => ({
  name: "creatv-carimbo-de-deploy",
  enforce: "post",
  generateBundle(_opcoes, bundle) {
    const doBundle = new Set(Object.keys(bundle).map((caminho) => caminho.split("/").pop()!));
    for (const arquivo of Object.values(bundle)) {
      if (arquivo.type !== "chunk") continue;
      arquivo.code = arquivo.code.replace(
        /(["'])\.\/([^"'/]+?\.(?:js|css))\1/g,
        (original, aspas, nome) =>
          doBundle.has(nome) ? `${aspas}./${nome}?dpl=${id}${aspas}` : original,
      );
    }
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(idDoDeploy ? [carimboNosImports(idDoDeploy)] : [])],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  experimental: idDoDeploy
    ? { renderBuiltUrl: (nomeDoArquivo: string) => `/${nomeDoArquivo}?dpl=${idDoDeploy}` }
    : undefined,
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
});
