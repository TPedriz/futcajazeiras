import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  todosAssociadosQuery,
  mensalidadesDoMesQuery,
  mesReferencia,
  papeisTodosQuery,
  valorMensalidadeQuery,
} from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FiltroCargo, type FiltroPapel } from "@/components/FiltroCargo";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, HandMetal, User, CalendarClock, ChevronLeft, ChevronRight, Coins } from "lucide-react";
import { useState } from "react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosAssociadosQuery()),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const { data: todos } = useSuspenseQuery(todosAssociadosQuery());
  const { data: papeis } = useQuery(papeisTodosQuery());
  const [refDate, setRefDate] = useState(() => new Date(`${mesReferencia()}T12:00:00`));
  const [filtro, setFiltro] = useState<FiltroPapel>("todos");
  const referencia = mesReferencia(refDate);
  const { data: mensalidades } = useQuery(mensalidadesDoMesQuery(referencia));
  const qc = useQueryClient();

  const papelDe = (id: string) => {
    const meus = (papeis ?? []).filter((p) => p.user_id === id).map((p) => p.papel);
    if (meus.includes("administrador")) return "administrador";
    if (meus.includes("associado")) return "associado";
    return "convidado";
  };
  const associados = todos.filter((a) => filtro === "todos" || papelDe(a.id) === filtro);

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

      <FiltroCargo valor={filtro} onChange={setFiltro} total={associados.length} />

      <ValorMensalidadeCard />





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

/** Reajuste do valor da mensalidade, com dupla confirmação. */
function ValorMensalidadeCard() {
  const qc = useQueryClient();
  const { data: valorAtual } = useQuery(valorMensalidadeQuery());
  const [novo, setNovo] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const salvar = useMutation({
    mutationFn: async () => {
      const valor = Number(novo.replace(",", "."));
      if (!Number.isFinite(valor) || valor <= 0) throw new Error("Informe um valor válido em reais.");
      const { error } = await supabase
        .from("configuracoes")
        .upsert({ chave: "valor_mensalidade", valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Valor da mensalidade atualizado", {
        description: "As próximas cobranças geradas já usam o novo valor.",
      });
      setConfirmando(false);
      setNovo("");
      qc.invalidateQueries({ queryKey: ["valor-mensalidade"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const formatado = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="card-premium space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Coins className="size-4 text-gold" />
        <p className="text-xs uppercase tracking-widest text-gold">Valor da mensalidade</p>
      </div>
      <p className="font-display text-3xl text-gold">{formatado(Number(valorAtual ?? 20))}</p>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          placeholder="Novo valor (ex.: 25)"
          aria-label="Novo valor da mensalidade"
          value={novo}
          className="h-11"
          onChange={(e) => {
            setNovo(e.target.value);
            setConfirmando(false);
          }}
        />
        <Button
          variant={confirmando ? "destructive" : "gold"}
          size="lg"
          disabled={!novo || salvar.isPending}
          onClick={() => (confirmando ? salvar.mutate() : setConfirmando(true))}
        >
          {confirmando ? "Confirmar" : "Alterar"}
        </Button>
      </div>
      {confirmando && (
        <p className="text-[11px] text-destructive">
          Confirme novamente: a mensalidade passará a ser cobrada por {novo.replace(".", ",")} reais para todos os
          associados. Toque em “Confirmar” para aplicar.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        O reajuste vale para as próximas cobranças geradas. Mensalidades já emitidas mantêm o valor original.
      </p>
    </div>
  );
}
