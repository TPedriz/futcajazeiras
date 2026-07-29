import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { todosAssociadosQuery, papeisTodosQuery, perfilAtualQuery } from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FiltroCargo, type FiltroPapel } from "@/components/FiltroCargo";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, User, HandHeart } from "lucide-react";


type Papel = "convidado" | "associado" | "administrador";

const rotulos: Record<Papel, string> = {
  convidado: "Convidado",
  associado: "Associado",
  administrador: "Diretoria",
};

export const Route = createFileRoute("/_authenticated/admin/cargos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosAssociadosQuery()),
  component: CargosPage,
});

function CargosPage() {
  const { data: associados } = useSuspenseQuery(todosAssociadosQuery());
  const { data: papeis } = useQuery(papeisTodosQuery());
  const { data: perfilData } = useSuspenseQuery(perfilAtualQuery());
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroPapel>("todos");


  const papelDe = (userId: string): Papel => {
    const meus = (papeis ?? []).filter((p) => p.user_id === userId).map((p) => p.papel);
    if (meus.includes("administrador")) return "administrador";
    if (meus.includes("associado")) return "associado";
    return "convidado";
  };

  const alterarCargo = useMutation({
    mutationFn: async ({ userId, papel }: { userId: string; papel: Papel }) => {
      const { error: delErro } = await supabase.from("papeis_usuario").delete().eq("user_id", userId);
      if (delErro) throw delErro;
      const { error } = await supabase.from("papeis_usuario").insert({ user_id: userId, papel });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cargo atualizado");
      qc.invalidateQueries({ queryKey: ["papeis-todos"] });
      qc.invalidateQueries({ queryKey: ["perfil-atual"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <div className="card-premium p-4">
        <p className="text-xs uppercase tracking-widest text-gold">Hierarquia de cargos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Convidado ➔ Associado ➔ Diretoria. Só a diretoria pode promover ou rebaixar.
        </p>
      </div>

      <ul className="space-y-2">
        {associados.map((a) => {
          const papel = papelDe(a.id);
          const euMesmo = a.id === perfilData?.user.id;
          const Icone = papel === "administrador" ? Shield : papel === "associado" ? User : HandHeart;
          return (
            <li key={a.id} className="card-premium flex items-center gap-3 p-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                  papel === "administrador" ? "bg-gold/10 text-gold" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icone className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.nome}</p>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {rotulos[papel]}
                </p>
              </div>
              <Select
                value={papel}
                disabled={euMesmo || alterarCargo.isPending}
                onValueChange={(v) => alterarCargo.mutate({ userId: a.id, papel: v as Papel })}
              >
                <SelectTrigger className="h-10 w-36" aria-label={`Cargo de ${a.nome}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="convidado">Convidado</SelectItem>
                  <SelectItem value="associado">Associado</SelectItem>
                  <SelectItem value="administrador">Diretoria</SelectItem>
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
