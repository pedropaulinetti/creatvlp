import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { router } from "@/app/router";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import { TooltipProvider } from "@/components/ui/overlays";
import { recarregarPorDeploy } from "@/lib/stale-chunk";
import "@/styles/app.css";

// O Vite avisa quando um arquivo pré-carregado some. Acontece quando sai um deploy
// novo e a aba de quem está usando ainda tem o index.html antigo: recarregar resolve.
window.addEventListener("vite:preloadError", (evento) => {
  if (recarregarPorDeploy()) evento.preventDefault();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        // Erros de permissão e de validação não melhoram com nova tentativa.
        if (message.includes("jwt") || message.includes("permission") || message.includes("row-level")) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 20_000,
    },
  },
});

/** Só a pesquisa legada mantém o tema escuro. Landing e app dividem o papel claro. */
function SurfaceTheme() {
  useEffect(() => {
    const apply = () => {
      const legacy = window.location.pathname.replace(/\/$/, "") === "/pesquisa";
      document.documentElement.dataset.surface = legacy ? "site" : "app";
    };
    apply();
    return router.subscribe(apply);
  }, []);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <TooltipProvider delayDuration={300}>
            <SurfaceTheme />
            <RouterProvider router={router} />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#FFFDFA",
                  border: "1px solid #E0DACF",
                  color: "#171412",
                  borderRadius: "12px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "13.5px",
                },
              }}
            />
          </TooltipProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
