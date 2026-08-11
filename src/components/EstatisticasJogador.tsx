import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  estatisticasDoUsuarioQuery,
  cartoesDoUsuarioQuery,
  todasSessoesQuery,
  politicaSuspensaoQuery,
} from "@/lib/babaQueries";
import { situacaoCartoesAmarelos } from "@/lib/situacaoAmarelos";

/** Seção "Minhas estatísticas" + aviso da janela de cartões amarelos no perfil. */
export function EstatisticasJogador({ usuarioId }: { usuarioId: string | undefined }) {
  const { data: stats } = useQuery(estatisticasDoUsuarioQuery(usuarioId));
  const { data: cartoes } = useQuery(cartoesDoUsuarioQuery(usuarioId));
  const { data: babas } = useQuery(todasSessoesQuery());
  const { data: pol } = useQuery(politicaSuspensaoQuery());

  const situacao = situacaoCartoesAmarelos({
    babas: (babas ?? []).map((b) => ({ id: b.id, data_horario: b.data_horario })),
    eventos: (cartoes ?? []).map((c) => ({
      baba_id: c.baba_id,
      quantidade: c.cartoesAmarelos,
    })),
    janela: pol?.janelaAmarelos ?? 5,
    limite: pol?.limiteAmarelos ?? 3,
  });

  const itens = [
    { rotulo: "Gols", valor: stats?.gols ?? 0, cor: "text-gold" },
    { rotulo: "Assistências", valor: stats?.assistencias ?? 0, cor: "text-sky-400" },
    {
      rotulo: "Pênaltis defendidos",
      valor: stats?.penaltisDefendidos ?? 0,
      cor: "text-violet-400",
    },
    { rotulo: "Amarelos", valor: stats?.cartoesAmarelos ?? 0, cor: "text-yellow-400" },
    { rotulo: "Azuis", valor: stats?.cartoesAzuis ?? 0, cor: "text-blue-400" },
    { rotulo: "Vermelhos", valor: stats?.cartoesVermelhos ?? 0, cor: "text-red-400" },
    { rotulo: "Faltas", valor: stats?.faltas ?? 0, cor: "text-orange-400" },
    { rotulo: "Gols contra", valor: stats?.golsContra ?? 0, cor: "text-rose-400" },
  ];

  return (
    <div className="card-premium space-y-3 p-4">
      <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
        <Sparkles className="size-4" /> Minhas estatísticas
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {itens.map((i) => (
          <div
            key={i.rotulo}
            className="rounded-lg border border-border/60 bg-surface p-3 text-center"
          >
            <p className={`font-display text-2xl ${i.cor}`}>{i.valor}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              {i.rotulo}
            </p>
          </div>
        ))}
      </div>

      {/* Janela de cartões amarelos */}
      <div className="space-y-2 rounded-xl border border-border/60 bg-surface p-3">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="size-4 text-yellow-400" />
          Janela de cartões amarelos ({situacao.janela} babas • limite {situacao.limite})
        </p>

        {situacao.amarelosNaJanela === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cartão amarelo nos últimos {situacao.janela} babas. Jogo limpo! 🟢
          </p>
        ) : situacao.suspenso ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <ShieldAlert className="size-4" /> Você está suspenso do próximo baba
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {situacao.amarelosNaJanela} cartões amarelos nos últimos {situacao.janela} babas.
            </p>
          </div>
        ) : situacao.emRisco ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <ShieldAlert className="size-4" /> Cuidado: {situacao.amarelosNaJanela} cartões
              amarelos
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Você não pode tomar outro cartão amarelo até{" "}
              <strong className="text-foreground">
                {situacao.expiraEm
                  ? format(situacao.expiraEm, "dd/MM/yyyy", { locale: ptBR })
                  : `os próximos ${Math.max(1, situacao.babasRestantes)} babas`}
              </strong>
              . Caso contrário, fica suspenso do próximo baba.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {situacao.amarelosNaJanela}{" "}
            {situacao.amarelosNaJanela === 1 ? "cartão amarelo" : "cartões amarelos"} nos últimos{" "}
            {situacao.janela} babas — dentro do limite.
          </p>
        )}
      </div>
    </div>
  );
}
