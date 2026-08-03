import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda e Regras — Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Tire dúvidas sobre check-in no baba, como levar convidados, pagamento da mensalidade por PIX e as regras do ranking do Fut Cajazeiras.",
      },
      { property: "og:title", content: "Central de Ajuda — Fut Cajazeiras" },
      {
        property: "og:description",
        content: "Guia rápido do Fut Cajazeiras: presença, convidados, PIX e regras do ranking.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AjudaPage,
});

const secoes = [
  {
    id: "jogar",
    titulo: "Como jogar / confirmar presença",
    itens: [
      [
        "Onde confirmo minha presença?",
        "Na aba Baba, toque em “Confirmar presença”. Sua vaga entra na lista oficial na hora.",
      ],
      [
        "Até quando posso confirmar?",
        "A lista abre às 22h do dia anterior e fecha automaticamente 3 horas antes do horário do jogo.",
      ],
      [
        "Posso cancelar?",
        "Pode, enquanto a lista estiver aberta. Depois que ela fecha, a desistência precisa ser resolvida com a diretoria.",
      ],
      [
        "Por que meu check-in está bloqueado?",
        "Ou a lista ainda não abriu / já fechou, ou a mensalidade está em aberto depois do dia 10, ou você está cumprindo suspensão por cartão vermelho.",
      ],
    ],
  },
  {
    id: "convidados",
    titulo: "Levar convidados",
    itens: [
      [
        "Sou associado, como levo alguém?",
        "Na aba Baba, use “Adicionar convidado”, informe o nome e gere o PIX do convidado.",
      ],
      [
        "Sou convidado, como entro?",
        "Convidado não entra direto: escolha um associado e envie uma solicitação. Se ele aceitar, o PIX é gerado para você pagar.",
      ],
      [
        "Quando o convidado é confirmado?",
        "Assim que o PIX é aprovado, o status muda de “Aguardando pagamento” para “Confirmado”.",
      ],
      [
        "Como viro associado?",
        "Participando de 3 babas como convidado. O progresso aparece no seu Perfil.",
      ],
    ],
  },
  {
    id: "pagamentos",
    titulo: "Pagamentos e PIX",
    itens: [
      [
        "Quando vence a mensalidade?",
        "Todo dia 10 de cada mês. Depois disso, o check-in fica bloqueado até o pagamento.",
      ],
      [
        "Como pago?",
        "Na aba Pagamentos, toque em gerar PIX. Escaneie o QR Code ou copie o código.",
      ],
      [
        "Quando libera?",
        "A confirmação é automática: assim que o PIX cai, o bloqueio some e você recebe uma notificação.",
      ],
      [
        "Posso pagar por outra pessoa?",
        "Pode. Em Pagamentos use “Presentear mensalidade” e escolha quem está com o mês em aberto.",
      ],
    ],
  },
  {
    id: "chegada",
    titulo: "Check-in na arena (GPS)",
    itens: [
      ["Quando abre?", "30 minutos antes do horário do baba e encerra 1 hora depois do início."],
      [
        "Preciso estar no local?",
        "Sim. O app valida seu GPS: você precisa estar a menos de 1 km da arena.",
      ],
      [
        "Para que serve a ordem?",
        "A ordem de chegada define quem entra primeiro nos times A e B no sorteio por chegada.",
      ],
      [
        "A lista fica pública?",
        "Só quando a diretoria libera a visualização. Antes disso, apenas a diretoria enxerga.",
      ],
    ],
  },
  {
    id: "perfil",
    titulo: "Perfil e foto",
    itens: [
      [
        "Como coloco minha foto?",
        "No Perfil, toque no ícone de câmera sobre o avatar e escolha uma imagem de até 5 MB.",
      ],
      [
        "Posso mudar meu nome?",
        "Pode. Toque no nome no Perfil e salve. A diretoria é avisada da alteração.",
      ],
      [
        "E o time do coração?",
        "A escolha entre Bahia e Vitória é definitiva; depois só a diretoria altera.",
      ],
    ],
  },
  {
    id: "regras",
    titulo: "Regras e ranking",
    itens: [
      [
        "Como funciona o ranking?",
        "Top 5 do mês por gols e assistências, com vitórias e derrotas contadas pelos times marcados como vencedores ou perdedores.",
      ],
      [
        "Quem lança as estatísticas?",
        "Somente a diretoria, pela aba Resultados. Gols, assistências e cartões podem ser corrigidos retroativamente em qualquer baba do histórico.",
      ],
      [
        "Cartão vermelho, e agora?",
        "Suspensão automática de 1 baba: você fica fora do próximo jogo e aparece no mural de punições.",
      ],
      [
        "Como funciona o sorteio?",
        "Times de 6 ou 7 jogadores, equilibrando goleiros e linha. Ninguém fica de fora: há os modos Aleatório, Ordem de chegada e BAxVI.",
      ],
      [
        "A mensalidade pode mudar de valor?",
        "Pode. A diretoria reajusta o valor no painel Financeiro e as próximas cobranças já saem com o novo valor.",
      ],
    ],
  },
];

function AjudaPage() {
  return (
    <div className="space-y-5">
      <div className="card-premium p-5">
        <p className="text-xs uppercase tracking-widest text-gold">Central de ajuda</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl">
          <LifeBuoy className="size-7 text-gold" /> Como funciona o baba
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tudo o que você precisa saber, dividido por assunto.
        </p>
      </div>

      {secoes.map((s) => (
        <section key={s.id} className="card-premium p-4">
          <h2 className="mb-1 font-display text-xl text-gold">{s.titulo}</h2>
          <Accordion type="single" collapsible>
            {s.itens.map(([pergunta, resposta], i) => (
              <AccordionItem key={pergunta} value={`${s.id}-${i}`}>
                <AccordionTrigger className="text-left text-sm">{pergunta}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {resposta}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
