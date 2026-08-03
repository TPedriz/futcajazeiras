import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BookOpenCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda da Diretoria — Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Guia rápido para a diretoria: como agendar e editar babas, controlar o financeiro, sortear times, lançar resultados e gerenciar cargos e usuários.",
      },
    ],
  }),
  component: AdminAjudaPage,
});

const secoes = [
  {
    id: "sessoes",
    titulo: "Sessões (agendar baba)",
    itens: [
      [
        "Como criar um baba?",
        "Em Sessões → Novo baba: informe data/horário, local, latitude/longitude (ou “Usar minha localização”) e o raio do check-in GPS (mínimo 100 m).",
      ],
      [
        "Quando a lista abre e fecha?",
        "Automático: abre às 22h do dia anterior e fecha 3h antes do jogo (fuso America/Bahia). Dá para ajustar por baba nos campos Abertura e Fechamento da lista.",
      ],
      [
        "Como editar um baba depois de criado?",
        "No cartão do baba, toque no lápis (Editar): altere data/horário, local, coordenadas, raio, abertura e fechamento. Ao mudar a data, a janela da lista acompanha.",
      ],
      [
        "Para que serve o cadeado?",
        "Fecha ou reabre a lista manualmente. Enquanto fechado, ninguém confirma nem cancela presença até você reabrir.",
      ],
      [
        "E o ícone de olho (visibilidade)?",
        "Mostra ou oculta a lista de chegada (GPS) para os demais usuários.",
      ],
      [
        "Como excluir um baba?",
        "Pela lixeira. A exclusão apaga o baba, as presenças, os times e as estatísticas dele — sem volta.",
      ],
    ],
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    itens: [
      [
        "Como reajusto a mensalidade?",
        "Defina o novo valor no campo de valor da mensalidade. As próximas cobranças já saem com o novo valor.",
      ],
      [
        "Como marco pago/pendente?",
        "Alterne o status do associado no mês. Pagamento confirmado libera o check-in e notifica o jogador.",
      ],
      [
        "Posso criar cobrança manual?",
        "Sim: gere a mensalidade de um associado em um mês específico caso ela ainda não exista.",
      ],
    ],
  },
  {
    id: "sorteio",
    titulo: "Sorteio",
    itens: [
      [
        "Como funciona?",
        "Usa as presenças confirmadas (membros + convidados aprovados). Escolha o tamanho dos times (6 ou 7) e o modo.",
      ],
      [
        "Quais modos existem?",
        "Aleatório, Ordem de chegada (quem chegou antes entra nos times A/B) e BAxVI (divide Bahia e Vitória).",
      ],
      [
        "Preciso salvar os times?",
        "Sim. “Salvar times” grava os times; só depois eles aparecem na aba Resultados.",
      ],
    ],
  },
  {
    id: "resultados",
    titulo: "Resultados",
    itens: [
      [
        "Como lanço o placar?",
        "Selecione o baba e marque o resultado de cada time: vitória, derrota ou empate.",
      ],
      [
        "Como lanço as estatísticas?",
        "Botões +/− por jogador: Gol, Assistência, Amarelo, Azul e Vermelho.",
      ],
      [
        "Cartão vermelho suspende?",
        "Sim: suspensão automática de 1 baba — o jogador é notificado e entra no mural de punições.",
      ],
      [
        "Posso corrigir depois?",
        "Sim, em qualquer baba do histórico. “Zerar mês” limpa um mês; “Zerar tudo” limpa todo o histórico.",
      ],
    ],
  },
  {
    id: "cargos",
    titulo: "Cargos",
    itens: [
      [
        "Como promovo ou rebaixo alguém?",
        "Em Cargos, mude o cargo do usuário: Convidado ➔ Associado ➔ Diretoria. Você não pode alterar o próprio cargo.",
      ],
      [
        "Existe limite de associados?",
        "Sim, 50 associados ativos. Para aprovar o 51º, desative alguém antes.",
      ],
    ],
  },
  {
    id: "usuarios",
    titulo: "Usuários",
    itens: [
      [
        "O que consigo editar no cadastro?",
        "Nome, WhatsApp e posição do jogador (goleiro ou linha).",
      ],
      [
        "Como desativo uma conta?",
        "Botão ativar/desativar: com a conta desativada, o check-in fica bloqueado e a mensagem avisa “Conta desativada”.",
      ],
      [
        "Como tiro alguém da lista do baba?",
        "O botão “Remover da lista” apaga a presença daquele baba.",
      ],
      [
        "E o time do coração?",
        "A escolha do usuário (Bahia/Vitória) é definitiva — só a diretoria consegue alterar.",
      ],
    ],
  },
];

function AdminAjudaPage() {
  return (
    <div className="space-y-5">
      <div className="card-premium p-5">
        <p className="text-xs uppercase tracking-widest text-gold">Guia da diretoria</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl">
          <BookOpenCheck className="size-7 text-gold" /> Como funciona o painel
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Resumo de cada funcionalidade do painel admin, tópico por tópico.
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
