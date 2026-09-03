import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { router } from "@/app/router";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import { TooltipProvider } from "@/components/ui/overlays";
import "@/styles/app.css";

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

/** A landing legada mantém o tema escuro; o app usa o tema claro de papel. */
function SurfaceTheme() {
  useEffect(() => {
    const apply = () => {
      const legacy = ["/", "/pesquisa"].includes(window.location.pathname.replace(/\/$/, "") || "/");
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
