import * as React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import {
  RequireAuth,
  RequireOnboarding,
  RequireAdmin,
  RequireSupabaseOutlet,
  RedirectIfAuthenticated,
  NotFound,
} from "@/app/guards";
import { LoadingBlock } from "@/components/ui/states";

const lazyPage = (loader: () => Promise<{ default: React.ComponentType }>) => {
  const Component = React.lazy(loader);
  return (
    <React.Suspense fallback={<LoadingBlock className="min-h-[60dvh]" />}>
      <Component />
    </React.Suspense>
  );
};

// A landing tem CSS próprio (tema escuro). A pesquisa continua sendo a página legada.
const LandingPage = React.lazy(() => import("@/pages/LandingPage"));
const ResearchPage = React.lazy(() =>
  import("@/legacy/pages.jsx").then((module) => ({ default: module.ConversationalResearchPage })),
);

// Páginas de superfície "site": CSS próprio, sem o fallback claro do app.
const surface = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <React.Suspense fallback={null}>
    <Component />
  </React.Suspense>
);

export const router = createBrowserRouter([
  { path: "/", element: surface(LandingPage) },
  { path: "/pesquisa", element: surface(ResearchPage) },

  {
    element: <RequireSupabaseOutlet />,
    children: [
  {
    path: "/login",
    element: <RedirectIfAuthenticated>{lazyPage(() => import("@/pages/LoginPage"))}</RedirectIfAuthenticated>,
  },
  {
    path: "/cadastro",
    element: <RedirectIfAuthenticated>{lazyPage(() => import("@/pages/SignUpPage"))}</RedirectIfAuthenticated>,
  },
  { path: "/recuperar-senha", element: lazyPage(() => import("@/pages/RecoverPasswordPage")) },

  {
    element: <RequireAuth />,
    children: [
      { path: "/onboarding", element: lazyPage(() => import("@/pages/OnboardingPage")) },
      {
        element: <RequireOnboarding />,
        children: [
          {
            path: "/app",
            element: <AppShell />,
            children: [
              { index: true, element: lazyPage(() => import("@/pages/HomePage")) },
              { path: "campanhas", element: lazyPage(() => import("@/pages/CampaignsPage")) },
              { path: "campanhas/nova", element: lazyPage(() => import("@/pages/NewCampaignPage")) },
              { path: "campanhas/:campaignId", element: lazyPage(() => import("@/pages/CampaignPage")) },
              // Rotinas ainda não está liberada: o menu fica travado e a rota devolve para o início.
              { path: "rotinas", element: <Navigate to="/app" replace /> },
              { path: "biblioteca", element: lazyPage(() => import("@/pages/LibraryPage")) },
              { path: "marca", element: lazyPage(() => import("@/pages/BrandPage")) },
              { path: "configuracoes", element: lazyPage(() => import("@/pages/SettingsPage")) },
            ],
          },
        ],
      },
      {
        element: <RequireAdmin />,
        children: [{ path: "/admin", element: lazyPage(() => import("@/pages/AdminPage")) }],
      },
    ],
  },

    ],
  },

  { path: "/entrar", element: <Navigate to="/login" replace /> },
  { path: "*", element: <NotFound /> },
]);
