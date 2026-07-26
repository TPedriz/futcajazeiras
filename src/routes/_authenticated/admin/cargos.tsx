import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { todosAssociadosQuery, papeisTodosQuery, perfilAtualQuery } from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/cargos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosAssociadosQuery()),
  component: CargosPage,
});

function CargosPage() {
  const { data: associados } = useSuspenseQuery(todosAssociadosQuery());
  const { data: papeis } = useQuery(papeisTodosQuery());
  const { data: perfilData } = useSuspenseQuery(perfilAtualQuery());
  const qc = useQueryClient();

  const adminIds = new Set((papeis ?? []).filter((p) => p.papel === "administrador").map((p) => p.user_id));

  const alterarCargo = useMutation({
    mutationFn: async ({ userId, tornarAdmin }: { userId: string; tornarAdmin: boolean }) => {
      if (tornarAdmin) {
        const { error } = await supabase
          .from("papeis_usuario")
          .insert({ user_id: userId, papel: "administrador" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("papeis_usuario")
          .delete()
          .eq("user_id", userId)
          .eq("papel", "administrador");
        if (error) throw error;
      }
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
        <p className="text-xs uppercase tracking-widest text-gold">Cargos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Promova associados à diretoria ou remova o acesso administrativo a qualquer momento.
        </p>
      </div>

      <ul className="space-y-2">
        {associados.map((a) => {
          const isAdmin = adminIds.has(a.id);
          const euMesmo = a.id === perfilData?.user.id;
          return (
            <li key={a.id} className="card-premium flex items-center gap-3 p-3">
              <div className={`flex size-9 items-center justify-center rounded-full ${isAdmin ? "bg-gold/10 text-gold" : "bg-muted text-muted-foreground"}`}>
                {isAdmin ? <Shield className="size-4" /> : <User className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.nome}</p>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {isAdmin ? "Diretoria" : "Associado"}
                </p>
              </div>
              <Button
                variant={isAdmin ? "outline" : "goldOutline"}
                size="sm"
                disabled={euMesmo || alterarCargo.isPending}
                onClick={() => alterarCargo.mutate({ userId: a.id, tornarAdmin: !isAdmin })}
              >
                {euMesmo ? "Você" : isAdmin ? "Rebaixar" : "Promover"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
