import { useEffect, useState } from "react";
import { Trophy, Zap } from "lucide-react";
import { useNotificacoes } from "@/components/NotificacoesProvider";

/**
 * Bolha comemorativa: aparece com efeitos quando o usuário sobe de nível
 * ou desbloqueia uma conquista. Escuta as notificações criadas pelos
 * triggers do banco (`concede_xp` -> tipo 'nivel' e `verifica_conquistas`
 * -> tipo 'conquista') via realtime e mostra uma fila animada.
 */

interface ItemBolha {
  id: string;
  tipo: "conquista" | "nivel";
  titulo: string;
  mensagem: string;
}

export function BubbleConquista() {
  const { filaCelebracao, removerCelebracao } = useNotificacoes();

  if (filaCelebracao.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[100] flex flex-col items-center gap-3 px-4">
      {filaCelebracao.map((item) => (
        <BubbleCard key={item.id} item={item} onDone={removerCelebracao} />
      ))}
      <style>{`
        @keyframes fc-pop {
          0%   { transform: scale(0.6) translateY(24px); opacity: 0; }
          60%  { transform: scale(1.05) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes fc-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(230,185,63,0.45); }
          50%      { box-shadow: 0 0 34px 8px rgba(230,185,63,0.35); }
        }
        @keyframes fc-saindo {
          to { opacity: 0; transform: translateY(-14px) scale(0.94); }
        }
        @keyframes fc-confete {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(64px) rotate(200deg); opacity: 0; }
        }
        .fc-bubble  { animation: fc-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both, fc-glow 1.6s ease-in-out infinite; }
        .fc-saindo  { animation: fc-saindo 0.4s ease-in forwards; }
        .fc-confete { position: absolute; width: 8px; height: 8px; border-radius: 9999px; animation: fc-confete 0.9s ease-out forwards; }
      `}</style>
    </div>
  );
}

function BubbleCard({ item, onDone }: { item: ItemBolha; onDone: (id: string) => void }) {
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSaindo(true), 3800);
    const t2 = setTimeout(() => onDone(item.id), 4400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [item.id, onDone]);

  const Nivel = item.tipo === "nivel";

  const confetes = Array.from({ length: 8 }, (_, i) => ({
    left: `${8 + i * 11}%`,
    top: "6%",
    background: ["#e6b93f", "#f472b6", "#60a5fa", "#34d399", "#a78bfa"][i % 5],
    animationDelay: `${i * 60}ms`,
  }));

  return (
    <div className={`fc-bubble relative w-full max-w-sm ${saindo ? "fc-saindo" : ""}`}>
      {confetes.map((c, i) => (
        <span
          key={i}
          className="fc-confete"
          style={{
            left: c.left,
            top: c.top,
            background: c.background,
            animationDelay: c.animationDelay,
          }}
        />
      ))}
      <div className="relative overflow-hidden rounded-2xl border border-gold/60 bg-surface/95 p-4 shadow-xl backdrop-blur">
        <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-gold/15 blur-2xl" />
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-amber-600 text-black shadow-inner">
            {Nivel ? <Zap className="size-6" /> : <Trophy className="size-6" />}
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight text-gold">{item.titulo}</p>
            <p className="text-xs leading-snug text-muted-foreground">{item.mensagem}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
