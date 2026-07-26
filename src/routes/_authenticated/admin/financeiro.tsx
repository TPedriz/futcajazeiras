import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { todosAssociadosQuery, mensalidadesDoMesQuery, mesReferencia } from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, HandMetal, User, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosAssociadosQuery()),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const { data: associados } = useSuspenseQuery(todosAssociadosQuery());
  const [refDate, setRefDate] = useState(() => new Date(`${mesReferencia()}T12:00:00`));
  const referencia = mesReferencia(refDate);
  const { data: mensalidades } = useQuery(mensalidadesDoMesQuery(referencia));
  const qc = useQueryClient();

  const porUsuario = new Map((mensalidades ?? []).map((m) => [m.usuario_id, m]));
  const ultimoDia = format(new Date(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)), "dd/MM/yyyy");

  const alterar = useMutation({
    mutationFn: async ({ usuarioId, status }: { usuarioId: string; status: "pago" | "pendente" }) => {
      const existente = porUsuario.get(usuarioId);
      if (existente) {
        const { error } = await supabase
          .from("mensalidades")
          .update({ status, pago_em: status === "pago" ? new Date().toISOString() : null })
          .eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mensalidades")
          .insert({ usuario_id: usuarioId, referencia, vencimento: referencia, status });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Mensalidade atualizada");
      qc.invalidateQueries({ queryKey: ["mensalidades-mes", referencia] });
      qc.invalidateQueries({ queryKey: ["associados-todos"] });
      qc.invalidateQueries({ queryKey: ["perfil-atual"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const emDia = associados.filter((a) => porUsuario.get(a.id)?.status === "pago").length;

  return (
    <div className="space-y-4">
      <div className="card-premium flex items-center justify-between p-3">
        <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setRefDate((d) => addMonths(d, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-center">
          <p className="font-display text-xl capitalize">
            {format(refDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <CalendarClock className="size-3" /> vence em {ultimoDia}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setRefDate((d) => addMonths(d, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

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
          const ok = porUsuario.get(a.id)?.status === "pago";
          return (
            <li key={a.id} className="card-premium flex items-center gap-3 p-3">
              <div className={`flex size-9 items-center justify-center rounded-full ${ok ? "bg-gold/10 text-gold" : "bg-destructive/10 text-destructive"}`}>
                {a.posicao === "goleiro" ? <HandMetal className="size-4" /> : <User className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.nome}</p>
                <p className="truncate text-[11px] text-muted-foreground">{a.telefone || a.email}</p>
              </div>
              <Button
                variant={ok ? "goldOutline" : "success"}
                size="sm"
                disabled={alterar.isPending}
                onClick={() => alterar.mutate({ usuarioId: a.id, status: ok ? "pendente" : "pago" })}
              >
                {ok ? <><AlertCircle className="size-3" /> Pendente</> : <><CheckCircle2 className="size-3" /> Pago</>}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
