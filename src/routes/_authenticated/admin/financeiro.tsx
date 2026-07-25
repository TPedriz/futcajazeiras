import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { todosAssociadosQuery } from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, HandMetal, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosAssociadosQuery()),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const { data: associados } = useSuspenseQuery(todosAssociadosQuery());
  const qc = useQueryClient();

  const alterar = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pago" | "pendente" }) => {
      const { error } = await supabase.from("perfis").update({ status_pagamento: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["associados-todos"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const emDia = associados.filter((a) => a.status_pagamento === "pago").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card-vip p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Em dia</p>
          <p className="font-display text-3xl text-gold">{emDia}</p>
        </div>
        <div className="card-premium p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pendentes</p>
          <p className="font-display text-3xl text-destructive">{associados.length - emDia}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {associados.map((a) => {
          const ok = a.status_pagamento === "pago";
          return (
            <li key={a.id} className="card-premium flex items-center gap-3 p-3">
              <div className={`flex size-9 items-center justify-center rounded-full ${ok ? "bg-gold/10 text-gold" : "bg-destructive/10 text-destructive"}`}>
                {a.posicao === "goleiro" ? <HandMetal className="size-4" /> : <User className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold">{a.nome}</p>
                <p className="truncate text-[11px] text-muted-foreground">{a.email}</p>
              </div>
              <Button
                variant={ok ? "goldOutline" : "success"}
                size="sm"
                onClick={() => alterar.mutate({ id: a.id, status: ok ? "pendente" : "pago" })}
              >
                {ok ? <><AlertCircle className="size-3" /> Marcar pendente</> : <><CheckCircle2 className="size-3" /> Marcar pago</>}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
