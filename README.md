<div align="center">

# ⚽ Fut Cajazeiras

**A gestão do seu baba na palma da mão — com ranking, gamificação e cartinhas de craque.**

Plataforma mobile-first para organizar o futebol de fim de semana: lista de presença, convidados,
pagamentos por PIX, sorteio de times, ranking mensal, conquistas, XP, níveis e **cartinhas de jogador
estilo EA FC / Ultimate Team** — tudo em um só lugar.

</div>

---

## ✨ Por que o Fut Cajazeiras?

Chega de planilha, caderno ou grupo de WhatsApp bagunçado. O Fut Cajazeiras transforma a rotina do
baba em uma experiência organizada **e divertida**:

- 🎯 **Menos trabalho para a diretoria** — presença, convidados, PIX e sorteio automatizados.
- 🎮 **Jogo dentro e fora de campo** — XP, níveis, conquistas e cartinha de cada jogador.
- 📱 **100% mobile** — o associado resolve tudo pelo celular, em segundos.
- 🔒 **Seguro e privado** — RLS no banco, admin separado, webhook de PIX validado.

> _"Confirme presença, leve seu convidado, acompanhe o pagamento e receba os times sorteados — tudo direto pelo celular. E agora, veja sua carreira no baba virar jogo."_

---

## 🎮 Gamificação e cartinhas

O diferencial que torna o baba viciante:

| Recurso                       | Descrição                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| ⚡ **XP e níveis**            | +10 XP por presença, +5 por gol, +3 por assistência. Suba de nível acompanhando a barra de progresso.          |
| 🏅 **Conquistas**             | Medalhas automáticas (Primeira Presença, Artilheiro, Nível 3, Veterano…) com notificação no sino.              |
| ⭐ **Conquistas em destaque** | Escolha até 3 medalhas para exibir ao lado do seu nome em todo o app.                                          |
| 🃏 **Cartinhas de jogador**   | OVR e atributos (RIT, FIN, PAS, DRI, DEF, FÍS) calculados do desempenho real, com visual de Ultimate Team.     |
| 🥇 **Temas da cartinha**      | Bronze → Prata → Ouro, e especiais **TOTW** (top 1 do mês), **Lenda do Baba** (Icon) e **Paredão** (goleiros). |
| 📤 **Compartilhar**           | Baixe sua cartinha em PNG ou compartilhe direto no WhatsApp/Instagram.                                         |
| 📊 **Ranking mensal**         | Top do mês em Gols, Assistências, Pênaltis defendidos e Cartões, com destaque 🥇🥈🥉.                          |

---

## 🛠️ Gestão completa para a diretoria

Painel administrativo com tudo o que a gestão do baba precisa:

- 🗓️ **Sessões** — agenda babas com data, horário, local e GPS da arena.
- 📋 **Lista de presença** — abertura às 22h da véspera, fechamento 3h antes, com trava manual pela diretoria.
- 🧑‍🤝‍🧑 **Convidados** — solicitação, aprovação (novos passam pela diretoria) e diária por PIX.
- 💳 **Financeiro** — mensalidades que vencem dia 10, PIX com confirmação automática, "presentear mensalidade" e diária de convidado.
- 🎲 **Sorteio de times** — 3 modos: **Aleatório**, **Ordem de chegada** (check-in GPS em 2 etapas) e **BAxVI** (Bahia × Vitória pelo time do coração).
- 🧮 **Resultados e estatísticas** — lança gols, assistências, pênaltis defendidos e cartões; ranking recalculado na hora.
- 🚨 **Punições automáticas** — cartão vermelho e faltas (3 em 5 babas) geram suspensão com política configurável.
- 🎚️ **Configurações** — valores de mensalidade/diária, política de suspensões e **atributos base das cartinhas** (pré-temporada).
- 🏷️ **Cargos** — controle de papéis (diretoria, associado, convidado).

---

## ✅ Muito além do essencial

Uma visão rápida do que a plataforma já entrega:

- 🔔 **Notificações em tempo real** (sino) para abertura/fechamento da lista, PIX aprovado, convidado e suspensão.
- 📍 **Check-in por GPS** com ordem de chegada para o sorteio.
- 🧑‍💼 **Fila de aprovação** de convidados para a diretoria.
- 📸 **Foto de perfil** com editor (zoom/reposicionar) e armazenamento privado.
- 💬 **Envio dos times para o WhatsApp** com um toque.
- 📊 **Ranking exportável como imagem** para compartilhar.
- 🆘 **Central de ajuda** completa dentro do app.
- 🗺️ **Locais fixos** de baba com geofence configurável.

---

## 🏗️ Stack

| Camada           | Tecnologia                                     |
| ---------------- | ---------------------------------------------- |
| Frontend         | React 19 + TanStack Start (file-based routing) |
| Estilo           | Tailwind CSS v4 + shadcn/ui (dark theme)       |
| Dados            | TanStack React Query                           |
| Backend          | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Pagamentos       | Mercado Pago — PIX (API + webhook)             |
| Export de imagem | html-to-image                                  |

---

## 🚀 Começando

### Pré-requisitos

- Node.js 20+ (recomendado via [nvm](https://github.com/nvm-sh/nvm))
- Uma conta no [Supabase](https://supabase.com) com o schema aplicado (`supabase/migrations`)
- Credenciais do **Mercado Pago** para o PIX em produção

### Instalação

```sh
git clone git@github.com:TPedriz/futcajazeiras.git
cd futcajazeiras
npm i
npm run dev
```

Configure as variáveis de ambiente (veja `docs/06-configuracao-e-deploy.md`):

```sh
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
MERCADOPAGO_ACCESS_TOKEN=...
```

### Testes

A lógica de regras é testada com Node (type-stripping):

```sh
node _test_checkin.ts        # janela e regras de check-in
node _test_sorteio.ts        # sorteio (aleatório, chegada, BAxVI, substituição)
node _test_gamificacao.ts    # XP, níveis e conquistas
node _test_cartinha.ts       # atributos, OVR e temas das cartinhas
```

---

## 📚 Documentação

- [Visão geral e arquitetura](docs/README.md) — conceitos, stack e diagramas.
- Banco de dados, lógica de negócio, backend, frontend, segurança, deploy e guia de recriação — tudo em `docs/`.

---

## 🤝 Sobre

Desenvolvido com carinho para o **Fut Cajazeiras** — futebol amador com
organização de time premium. Conectado ao GitHub; mudanças feitas no Lovable são commitadas direto
no repositório.

<p align="center">
  <sub>Feito com ⚽ e muita resenha.</sub>
</p>
