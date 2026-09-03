import { ChevronDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { canAddBrand } from "@/lib/permissions";

function brandSwatch(colors: unknown): string {
  if (Array.isArray(colors)) {
    const primary = colors.find(
      (item): item is { hex: string; role?: string } =>
        typeof item === "object" && item !== null && "hex" in item,
    );
    if (primary?.hex) return primary.hex;
  }
  return "#8A6A42";
}

export function BrandSwitcher({ compact = false }: { compact?: boolean }) {
  const { brand, brands, selectBrand, plan } = useWorkspace();
  const navigate = useNavigate();
  if (!brand) return null;

  const allowsNewBrand = canAddBrand(brands.length, plan?.brands_limit ?? 1);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-[8px] border border-line bg-transparent text-[12.5px] text-ink",
          "transition-colors hover:border-line-contrast focus-visible:outline-none",
          compact ? "h-7 px-2" : "h-[30px] px-2.5",
        )}
        aria-label={`Marca ativa: ${brand.name}. Trocar de marca`}
      >
        <span
          aria-hidden
          className="h-[15px] w-[15px] shrink-0 rounded-[4px]"
          style={{ background: brandSwatch(brand.colors) }}
        />
        {!compact && <span className="max-w-[180px] truncate">{brand.name}</span>}
        <ChevronDown className="h-3 w-3 text-ink-faint" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Marcas</DropdownMenuLabel>
        {brands.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => selectBrand(item.id)}>
            <span
              aria-hidden
              className="h-[15px] w-[15px] shrink-0 rounded-[4px]"
              style={{ background: brandSwatch(item.colors) }}
            />
            <span className="truncate">{item.name}</span>
            {item.id === brand.id && <span className="ml-auto label-mono">ativa</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!allowsNewBrand}
          onSelect={() => navigate("/app/marca?nova=1")}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {allowsNewBrand ? "Nova marca" : `Limite de ${plan?.brands_limit ?? 1} marca no plano`}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
