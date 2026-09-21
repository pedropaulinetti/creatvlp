import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
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

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
