import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Gera uma URL assinada temporária para a foto guardada no armazenamento privado. */
export const avatarUrlQuery = (caminho: string | null | undefined) => ({
  queryKey: ["avatar-url", caminho],
  enabled: !!caminho,
  staleTime: 1000 * 60 * 30,
  queryFn: async () => {
    if (!caminho) return null;
    const { data } = await supabase.storage.from("avatares").createSignedUrl(caminho, 60 * 60);
    return data?.signedUrl ?? null;
  },
});

const tamanhos = { sm: "size-9", md: "size-12", lg: "size-24" } as const;

export function AvatarJogador({
  caminho,
  nome,
  size = "sm",
  className = "",
}: {
  caminho?: string | null;
  nome?: string | null;
  size?: keyof typeof tamanhos;
  className?: string;
}) {
  const { data: url } = useQuery(avatarUrlQuery(caminho));
  const iniciais = (nome ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <span
      className={`flex ${tamanhos[size]} shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/30 bg-surface font-display text-gold ${className}`}
    >
      {url ? (
        <img src={url} alt={nome ? `Foto de ${nome}` : "Foto do jogador"} className="size-full object-cover" />
      ) : iniciais ? (
        <span className={size === "lg" ? "text-3xl" : "text-sm"}>{iniciais}</span>
      ) : (
        <User className="size-1/2 text-muted-foreground" />
      )}
    </span>
  );
}
