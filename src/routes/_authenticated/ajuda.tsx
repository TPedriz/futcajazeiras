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
        "Como sei se a lista já abriu ou fechou?",
        "Na Home há um banner com o status em tempo real: “Abre em Xh”, “Fecha em Xh” ou “Lista encerrada”, além dos horários exatos de abertura e fechamento.",
      ],
      [
        "Por que meu check-in está bloqueado?",
        "Ou a lista ainda não abriu / já fechou, ou a mensalidade está em aberto depois do dia 10, ou você está cumprindo suspensão por cartão vermelho.",
      ],
      [
        "Não tenho celular / não consigo confirmar. E agora?",
        "Fale com a diretoria: ela consegue colocar seu nome na lista de presença e marcar seu check-in no campo a partir do painel dela, mesmo depois do fechamento.",
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
        "Convidado não entra direto: escolha um associado e envie uma solicitação. Ele aceita e, se você for convidado novo, a diretoria aprova antes de qualquer PIX. Aprovado, o PIX é gerado para você pagar.",
      ],
      [
        "Quando o convidado é confirmado?",
        "Assim que o PIX é aprovado, o status muda de “Aguardando pagamento” para “Confirmado”.",
      ],
      [
        "A janela da lista vale para convidados?",
        "Sim. A lista abre às 22h do dia anterior e fecha 3h antes do jogo — para associados e convidados.",
      ],
      [
        "Como viro associado?",
        "É simples: participe de 3 babas como convidado (pagando a diária de cada um). A cada baba pago, seu progresso aumenta — veja no card “Caminho para virar Associado” na Home e no Perfil. Ao completar 3, aparece o botão “Solicitar associação”; a diretoria analisa e, se aprovado, você vira associado e entra no grupo oficial do WhatsApp. Se você já jogou babas antes do app existir, a diretoria pode registrar esse crédito para você.",
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
      [
        "Quando entro no grupo do WhatsApp?",
        "O grupo oficial é só para associados. Quando sua associação é aprovada pela diretoria e você paga a mensalidade, aparece o botão “Entrar no grupo” na tela de Pagamentos. Enquanto for convidado, o link não aparece.",
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
        "No Perfil, toque no ícone de câmera sobre o avatar e escolha uma imagem de até 5 MB. Abre um editor: arraste para reposicionar e use o controle de zoom, com pré-visualização em tempo real do círculo. Toque em “Salvar foto” para aplicar. Já tem foto? Use o botão “Ajustar foto” abaixo do avatar para reposicionar, dar zoom ou recortar a foto atual sem precisar enviar outra.",
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
        "Top 5 do mês por categoria: Gols, Assistências, Pênaltis defendidos e Cartões. Na Home você alterna entre as categorias. Cartões só contam para a própria categoria de cartões — não colocam ninguém no ranking de gols, assistências ou pênaltis.",
      ],
      [
        "Pênaltis defendidos vale para todos?",
        "Sim. Qualquer jogador (linha ou goleiro) pode ter pênaltis defendidos registrados — já que jogador de linha também vai pro gol quando não há goleiro.",
      ],
      [
        "Quem lança as estatísticas?",
        "Somente a diretoria, pelas abas Resultados e Estatísticas. Gols, assistências, pênaltis defendidos e cartões podem ser lançados ou corrigidos em qualquer baba do histórico.",
      ],
      [
        "Cartão vermelho, e agora?",
        "Suspensão automática de 1 baba: você fica fora do próximo jogo e aparece no mural de punições.",
      ],
      [
        "Onde vejo punições e avisos?",
        "O mural de punições fica na página do Baba. Avisos (aprovação de convidado, pagamento confirmado, suspensão, abertura/fechamento da lista) chegam pelo sino de notificações no topo.",
      ],
      [
        "Como funciona o sorteio?",
        "A diretoria monta os times com os nomes confirmados na lista — ninguém que confirmou fica de fora. Os times têm 6 ou 7 jogadores. Há três modos: 1) Aleatório — embaralha todo mundo. 2) Ordem de chegada — quem marcou o check-in por GPS primeiro tem prioridade: os 12 primeiros da linha formam os Times A e B, e quem chega depois vai sendo encaixado em uma segunda rodada de sorteio. 3) BAxVI — Bahia contra Vitória, pelo time do coração cadastrado no perfil. Cada time tem seu goleiro; se faltar goleiro, um jogador de linha assume o gol. O resultado é divulgado no grupo do WhatsApp.",
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
