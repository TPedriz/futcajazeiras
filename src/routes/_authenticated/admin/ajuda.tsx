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
      [
        "O que são os “Locais de baba”?",
        "Endereços fixos (nome, GPS e raio) salvos para reutilizar ao criar babas. Ex.: Arena Cajazeiras. Em Sessões, escolha um local salvo para preencher nome, coordenadas e raio automaticamente.",
      ],
      [
        "Removi alguém da lista sem querer. E agora?",
        "Na página do Baba (como admin), use “Adicionar” na Lista de presença: o jogador volta para a lista e o check-in do campo é marcado, a qualquer momento — mesmo após o fechamento.",
      ],
      [
        "E se um jogador não tiver celular para confirmar?",
        "A diretoria resolve na página do Baba: botão “Adicionar” na Lista de presença → escolha o jogador → “Só lista” (coloca o nome na lista de presença) ou “Lista + check-in” (coloca na lista E marca a chegada no campo). Funciona mesmo depois do fechamento da lista — ninguém fica de fora por falta de celular.",
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
        "Como reajusto a diária do convidado?",
        "No campo “Valor da diária de convidado”, defina o novo valor (mesmo esquema da mensalidade, com dupla confirmação). Os próximos PIX de convidado já saem com o novo valor.",
      ],
      [
        "Como filtro pagos/pendentes?",
        "Use os botões Todos / Pagos / Pendentes no topo da lista para ver só quem já pagou ou quem está em aberto no mês.",
      ],
      [
        "Onde vejo quantos associados temos?",
        "No card “Associados cadastrados”: mostra o total ativo em relação ao limite de 50, com barra de progresso e o número de vagas livres.",
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
        "Como funciona o sorteio?",
        "O sorteio monta os times usando as presenças confirmadas da lista (associados + convidados aprovados). Você escolhe o tamanho dos times (6 ou 7 jogadores) e o modo. A regra de ouro é: ninguém fica de fora — todo mundo confirmado entra em algum time, mesmo que o último time fique com menos gente.",
      ],
      [
        "Quais são os modos de sorteio?",
        "São três: 1) Aleatório — embaralha todo mundo e distribui entre os times. 2) Ordem de chegada — usa o check-in por GPS, em duas etapas (veja a próxima pergunta). 3) BAxVI — divide os associados entre Time Bahia e Time Vitória, pelo time do coração cadastrado no perfil.",
      ],
      [
        "Como funciona o modo “Ordem de chegada” (2 etapas)?",
        "A ideia é premiar quem chegou cedo. 1ª etapa: os 12 primeiros jogadores de linha que marcaram chegada são embaralhados e formam os Times A e B (6 em cada); os demais que já chegaram seguem para os Times C em diante, também na ordem de chegada. 2ª etapa: conforme mais gente vai chegando ao campo (retardatários), você executa o segundo sorteio e eles são encaixados — primeiro no último time que ainda está incompleto e, se precisar, em times novos. Tudo isso mantendo os times já montados.",
      ],
      [
        "O que é goleiro fixo?",
        "É um goleiro marcado como “Fixo” (na página do Baba) para poder cobrir mais de um time quando faltar goleiro. No sorteio, os goleiros são distribuídos um por time: primeiro os normais, depois os fixos em rodízio. Se mesmo assim faltar goleiro, o sorteio promove um jogador de linha para o gol e mostra um aviso de “déficit de goleiros”.",
      ],
      [
        "Posso trocar um jogador depois do sorteio?",
        "Sim. Cada jogador dos times tem um botão ⇄ (substituir). Toque nele, escolha quem entra (a lista mostra os jogadores que ainda não têm time, como os retardatários) e confirme. O jogador escolhido assume a vaga — no gol, se a vaga era do goleiro. Quem saiu volta para o grupo de disponíveis. Isso funciona em qualquer momento do sorteio, inclusive depois da 2ª etapa.",
      ],
      [
        "Preciso salvar os times?",
        "Sim. Toque em “Salvar times” para gravar os times montados. Só depois de salvar eles aparecem na aba Resultados para lançar o placar e as estatísticas. Você também pode copiar os times para o WhatsApp antes de salvar.",
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
        "Botões +/− por jogador: Gol, Assistência, Pênalti defendido, Amarelo, Azul e Vermelho. (Pênalti defendido vale para qualquer jogador, não só goleiro.)",
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
    id: "estatisticas",
    titulo: "Estatísticas (lançamento manual)",
    itens: [
      [
        "Para que serve essa aba?",
        "Lançar ou corrigir estatísticas de qualquer usuário em qualquer baba do histórico — mesmo quando o sorteio falhou e os times não foram salvos.",
      ],
      [
        "O que consigo lançar?",
        "Gols, assistências, pênaltis defendidos, amarelos, azuis e vermelhos.",
      ],
      [
        "Como uso?",
        "Escolha o baba e o usuário, ajuste os números e toque em Salvar. O ranking do mês recalcula na hora. Há também o botão Remover para apagar o lançamento.",
      ],
      [
        "Pênaltis defendidos é só para goleiros?",
        "Não. Qualquer jogador pode ir pro gol quando não há goleiro, então o campo está disponível para todos.",
      ],
      [
        "Qual a diferença para a aba Resultados?",
        "Resultados lança os números dos jogadores que estão nos times salvos daquele baba. Estatísticas permite lançar para qualquer usuário, mesmo sem times salvos.",
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
      [
        "Onde aprovo convidados novos?",
        "Na aba Usuários, na fila “Aprovações de convidados”. Nenhum PIX é gerado antes da aprovação; aprovado uma vez, o convidado vira “da casa” e entra direto nos próximos babas.",
      ],
      [
        "Como aplico ou removo uma punição?",
        "Em Usuários → Punições: escolha o usuário (qualquer cargo), o baba a bloquear e o motivo. A punição bloqueia o check-in dele nesse baba e aparece no mural. Use o X para remover.",
      ],
      [
        "Faltas suspendem automaticamente?",
        "Sim. Ao completar 3 faltas nos últimos 5 babas, o jogador é suspenso automaticamente do próximo baba (motivo “3 faltas nos últimos 5 babas”) e notificado. Se você desfizer a falta, a suspensão automática daquele baba some sozinha. A suspensão por cartão vermelho continua igual: 1 baba.",
      ],
      [
        "Como marco falta de quem não apareceu?",
        "Na página do Baba, na Lista de presença, quem está na lista mas ainda não fez check-in tem um botão de falta (usuário riscado, em vermelho). Toque para marcar: o nome fica riscado com o selo “Falta”. Toque de novo para desfazer. Vale para associados e convidados aprovados.",
      ],
      [
        "Um convidado jogou 3 babas antes do app existir. Como registro isso?",
        "Em Usuários → Babas dos convidados → Ajustar babas: escolha o convidado, informe quantos babas ele já jogou (crédito) e, se quiser, uma observação. Salve. Esse crédito soma ao contador dele no Perfil e, ao atingir 3, ele libera o pedido de associação. Para remover o ajuste, use o X na lista.",
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
