import { useQuery } from "@tanstack/react-query";
import { signedUrl, signedUrls } from "@/lib/storage";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

/** URLs assinadas e temporárias — os arquivos nunca ficam públicos. */
export function useSignedUrls(bucket: string, paths: (string | null)[]) {
  const clean = paths.filter((path): path is string => Boolean(path));
  const key = clean.slice().sort().join("|");

  return useQuery({
    queryKey: ["signed-urls", bucket, key],
    enabled: clean.length > 0,
    // As URLs valem uma hora; renovamos com folga.
    staleTime: 45 * 60_000,
    gcTime: 50 * 60_000,
    queryFn: () => signedUrls(bucket, clean),
  });
}

export function useBrandLogoUrl() {
  const { brand } = useWorkspace();
  return useQuery({
    queryKey: ["brand-logo", brand?.id, brand?.logo_path],
    enabled: Boolean(brand?.logo_path),
    staleTime: 45 * 60_000,
    queryFn: () => signedUrl("brand-assets", brand!.logo_path),
  });
}
