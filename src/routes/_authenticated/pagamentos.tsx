import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { perfilAtualQuery, minhasMensalidadesQuery } from "@/lib/babaQueries";
import { tempoDeAssociado } from "@/lib/associado";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, AlertCircle, CalendarClock, Wallet, Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pagamentos")({
  head: () => ({
    meta: [
      { title: "Meus Pagamentos — Fut Cajazeiras" },
      { name: "description", content: "Acompanhe o histórico de mensalidades do Fut Cajazeiras: meses pagos, pendentes e a data de vencimento, sempre no último dia de cada mês." },
      { property: "og:title", content: "Histórico de Mensalidades — Fut Cajazeiras" },
      { property: "og:description", content: "Veja mês a mês suas mensalidades pagas e pendentes no Fut Cajazeiras." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const { data: perfilData } = useSuspenseQuery(perfilAtualQuery());
  const { data: mensalidades, isLoading } = useQuery(minhasMensalidadesQuery(perfilData?.user.id));

  const tempo = tempoDeAssociado(perfilData?.perfil?.criado_em);
  const pagas = (mensalidades ?? []).filter((m) => m.status === "pago").length;
  const pendentes = (mensalidades ?? []).filter((m) => m.status === "pendente").length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-gold">Financeiro</p>
        <h1 className="font-display text-4xl">Meus pagamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A mensalidade vira todo <strong className="text-foreground">último dia do mês</strong>.
        </p>
      </div>

      {tempo && (
        <div className="card-vip flex items-center gap-3 p-4">
          <Heart className="size-5 shrink-0 text-gold" />
          <p className="text-sm text-muted-foreground">
            Você é do baba há <strong className="text-gold">{tempo.texto}</strong> — {pagas} {pagas === 1 ? "mensalidade paga" : "mensalidades pagas"} nessa caminhada.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="card-vip p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pagas</p>
          <p className="font-display text-3xl text-gold">{pagas}</p>
        </div>
        <div className="card-premium p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pendentes</p>
          <p className="font-display text-3xl text-destructive">{pendentes}</p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando histórico...</p>}

      <ul className="space-y-2">
        {(mensalidades ?? []).map((m) => {
          const pago = m.status === "pago";
          const atrasado = !pago && new Date(m.vencimento) < new Date();
          return (
            <li key={m.id} className="card-premium flex items-center gap-3 p-4">
              <div className={`flex size-10 items-center justify-center rounded-full ${pago ? "bg-gold/10 text-gold" : "bg-destructive/10 text-destructive"}`}>
                {pago ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl capitalize leading-none">
                  {format(new Date(`${m.referencia}T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="size-3" />
                  Vence em {format(new Date(`${m.vencimento}T12:00:00`), "dd/MM/yyyy")}
                  {pago && m.pago_em && ` • pago em ${format(new Date(m.pago_em), "dd/MM")}`}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                  pago ? "bg-gold/10 text-gold" : atrasado ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                }`}
              >
                {pago ? "Pago" : atrasado ? "Atrasado" : "Em aberto"}
              </span>
            </li>
          );
        })}
      </ul>

      {!isLoading && (mensalidades ?? []).length === 0 && (
        <div className="card-premium p-6 text-center">
          <Wallet className="mx-auto size-10 text-muted-foreground/50" />
          <p className="mt-3 font-display text-xl">Sem lançamentos ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Assim que a diretoria abrir o mês, ele aparece aqui.</p>
        </div>
      )}
    </div>
  );
}
