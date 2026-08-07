import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  todosAssociadosQuery,
  papeisTodosQuery,
  proximaSessaoQuery,
  presencasDaSessaoQuery,
  todasSessoesQuery,
  suspensoesQuery,
  ajustesBabasConvidadoQuery,
  politicaSuspensaoQuery,
} from "@/lib/babaQueries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FiltroCargo, type FiltroPapel } from "@/components/FiltroCargo";
import { AprovacoesConvidados } from "@/components/AprovacoesConvidados";
import { toast } from "sonner";
import { useState } from "react";
import { formataTelefone, normalizaTelefone } from "@/lib/telefone";
import { Pencil, UserMinus, Save, X, Power, Gavel, Trophy, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const { data: todos } = useSuspenseQuery(todosAssociadosQuery());
  const { data: papeis } = useQuery(papeisTodosQuery());
  const { data: sessao } = useQuery(proximaSessaoQuery());
  const { data: presencas } = useQuery(presencasDaSessaoQuery(sessao?.id));
  const { data: suspensoes } = useQuery(suspensoesQuery());
  const { data: todas } = useQuery(todasSessoesQuery());
  const { data: ajustes } = useQuery(ajustesBabasConvidadoQuery());
  const qc = useQueryClient();

  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [posicao, setPosicao] = useState<"linha" | "goleiro">("linha");
  // Atributos base da cartinha (pré-temporada) — o sistema recalcula nos babas.
  const [atributos, setAtributos] = useState({
    ovr: 40,
    ritmo: 40,
    finalizacao: 40,
    passe: 40,
    drible: 40,
    defesa: 40,
    fisico: 40,
  });
  const [filtro, setFiltro] = useState<FiltroPapel>("todos");
  const [aplicandoPunicao, setAplicandoPunicao] = useState(false);
  const [punicaoUserId, setPunicaoUserId] = useState("");
  const [punicaoBabaId, setPunicaoBabaId] = useState("");
  const [punicaoMotivo, setPunicaoMotivo] = useState("");
  const [ajusteBabasAberto, setAjusteBabasAberto] = useState(false);
  const [ajusteBabasUserId, setAjusteBabasUserId] = useState("");
  const [ajusteBabasValor, setAjusteBabasValor] = useState("");
  const [ajusteBabasObs, setAjusteBabasObs] = useState("");

  const babasFuturos = (todas ?? [])
    .filter((b) => new Date(b.data_horario).getTime() > Date.now())
    .sort((a, b) => new Date(a.data_horario).getTime() - new Date(b.data_horario).getTime());
  const nomesUsuarios = new Map((todos ?? []).map((u) => [u.id, u.nome]));
  const nomesBabas = new Map(
    (todas ?? []).map((b) => [
      b.id,
      format(new Date(b.data_horario), "dd/MM 'às' HH:mm", { locale: ptBR }),
    ]),
  );

  const papelDe = (id: string) => {
    const meus = (papeis ?? []).filter((p) => p.user_id === id).map((p) => p.papel);
    if (meus.includes("administrador")) return "administrador";
    if (meus.includes("associado")) return "associado";
    return "convidado";
  };
  const perfis = todos.filter((p) => filtro === "todos" || papelDe(p.id) === filtro);

  const salvar = useMutation({
    mutationFn: async (id: string) => {
      if (nome.trim().length < 2) throw new Error("Informe o nome completo");
      const { error } = await supabase
        .from("perfis")
        .update({
          nome: nome.trim(),
          telefone: normalizaTelefone(telefone),
          posicao,
          ovr: atributos.ovr,
          stat_ritmo: atributos.ritmo,
          stat_finalizacao: atributos.finalizacao,
          stat_passe: atributos.passe,
          stat_drible: atributos.drible,
          stat_defesa: atributos.defesa,
          stat_fisico: atributos.fisico,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cadastro atualizado");
      setEditando(null);
      qc.invalidateQueries({ queryKey: ["associados-todos"] });
      qc.invalidateQueries({ queryKey: ["perfis-publicos"] });
      qc.invalidateQueries({ queryKey: ["cartinha-perfil"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const removerDaLista = useMutation({
    mutationFn: async (usuarioId: string) => {
      const alvo = (presencas ?? []).find((p) => p.usuario_id === usuarioId && !p.nome_convidado);
      if (!alvo) throw new Error("Esse jogador não está na lista do próximo baba");
      const { error } = await supabase.from("presencas").delete().eq("id", alvo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido da lista do baba");
      qc.invalidateQueries({ queryKey: ["presencas", sessao?.id] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const alternarAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("perfis").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.ativo ? "Usuário reativado" : "Usuário desativado");
      qc.invalidateQueries({ queryKey: ["associados-todos"] });
      qc.invalidateQueries({ queryKey: ["perfis-publicos"] });
      qc.invalidateQueries({ queryKey: ["vagas-associados"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const aplicarPunicao = useMutation({
    mutationFn: async () => {
      if (!punicaoUserId || !punicaoBabaId) throw new Error("Escolha usuário e baba");
      const { error } = await supabase.from("suspensoes").insert({
        usuario_id: punicaoUserId,
        baba_bloqueado_id: punicaoBabaId,
        motivo: punicaoMotivo.trim() || "Punição da diretoria",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Punição aplicada!");
      setAplicandoPunicao(false);
      setPunicaoUserId("");
      setPunicaoBabaId("");
      setPunicaoMotivo("");
      qc.invalidateQueries({ queryKey: ["suspensoes"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const removerPunicao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suspensoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Punição removida");
      qc.invalidateQueries({ queryKey: ["suspensoes"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  /** Recalcula as cartinhas de todos os jogadores a partir do desempenho real. */
  const recalcularCartinhas = useMutation({
    mutationFn: async () => {
      const ids = (todos ?? []).map((u) => u.id);
      for (const id of ids) {
        const { error } = await supabase.rpc("calcula_cartinha", { usuario: id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cartinhas recalculadas!", {
        description: "OVR e atributos atualizados com o desempenho real.",
      });
      qc.invalidateQueries({ queryKey: ["associados-todos"] });
      qc.invalidateQueries({ queryKey: ["cartinha-perfil"] });
    },
    onError: (e: Error) => toast.error("Erro ao recalcular", { description: e.message }),
  });

  /** Salva o crédito manual de babas pagos do convidado (upsert por usuário). */
  const salvarAjusteBabas = useMutation({
    mutationFn: async () => {
      if (!ajusteBabasUserId) throw new Error("Escolha o usuário");
      const valor = Number(ajusteBabasValor.replace(",", "."));
      if (!Number.isInteger(valor) || valor < 0)
        throw new Error("Informe um número inteiro maior ou igual a 0.");
      const { error } = await supabase.from("ajustes_babas_convidado").upsert(
        {
          usuario_id: ajusteBabasUserId,
          babas_credito: valor,
          observacao: ajusteBabasObs.trim(),
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "usuario_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Babas do convidado atualizados!");
      setAjusteBabasAberto(false);
      setAjusteBabasUserId("");
      setAjusteBabasValor("");
      setAjusteBabasObs("");
      qc.invalidateQueries({ queryKey: ["ajustes-babas-convidado"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const removerAjusteBabas = useMutation({
    mutationFn: async (usuarioId: string) => {
      const { error } = await supabase
        .from("ajustes_babas_convidado")
        .delete()
        .eq("usuario_id", usuarioId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ajuste removido");
      qc.invalidateQueries({ queryKey: ["ajustes-babas-convidado"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const naLista = (id: string) =>
    (presencas ?? []).some((p) => p.usuario_id === id && !p.nome_convidado);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-gold">Cadastros</p>
        <h2 className="font-display text-2xl">Usuários</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edite nome, WhatsApp e posição, desative quem saiu do baba (sem apagar o histórico) e tire
          quem quiser da lista do próximo baba.
        </p>
      </div>

      <AprovacoesConvidados />

      <div className="card-premium p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-display text-xl">Punições</p>
          <Button variant="goldOutline" size="sm" onClick={() => setAplicandoPunicao((v) => !v)}>
            <Gavel className="size-4" /> Aplicar punição
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Suspenda qualquer usuário (de qualquer cargo) de um baba, a qualquer momento. A punição
          bloqueia o check-in dele nesse baba e aparece no mural.
        </p>

        {aplicandoPunicao && (
          <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
            <Select value={punicaoUserId} onValueChange={setPunicaoUserId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Escolha o usuário" />
              </SelectTrigger>
              <SelectContent>
                {todos.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={punicaoBabaId} onValueChange={setPunicaoBabaId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Bloquear em qual baba?" />
              </SelectTrigger>
              <SelectContent>
                {babasFuturos.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {format(new Date(b.data_horario), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Motivo (ex.: comportamento, atraso…)"
              value={punicaoMotivo}
              onChange={(e) => setPunicaoMotivo(e.target.value)}
              className="h-11"
            />
            <Button
              variant="hero"
              className="w-full"
              disabled={!punicaoUserId || !punicaoBabaId || aplicarPunicao.isPending}
              onClick={() => aplicarPunicao.mutate()}
            >
              <Gavel className="size-4" /> Aplicar punição
            </Button>
          </div>
        )}

        {(suspensoes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma punição ativa.</p>
        ) : (
          <ul className="space-y-2">
            {(suspensoes ?? []).map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {nomesUsuarios.get(s.usuario_id) ?? "Jogador"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Bloqueado em{" "}
                    {s.baba_bloqueado_id ? nomesBabas.get(s.baba_bloqueado_id) : "próximo baba"} •{" "}
                    {s.motivo}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="Remover punição"
                  onClick={() => removerPunicao.mutate(s.id)}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PoliticaSuspensaoCard />

      {/* Cartinhas: recálculo manual de OVR/atributos */}
      <div className="card-premium space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
              <SlidersHorizontal className="size-4" /> Cartinhas de jogador
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Recalcula o OVR e os atributos (RIT, FIN, PAS, DRI, DEF, FÍS) de todos os jogadores a
              partir do desempenho real. Os ajustes manuais feitos no cadastro são preservados até o
              próximo lançamento.
            </p>
          </div>
        </div>
        <Button
          variant="gold"
          size="lg"
          className="w-full"
          disabled={recalcularCartinhas.isPending}
          onClick={() => recalcularCartinhas.mutate()}
        >
          <SlidersHorizontal className="size-4" />
          {recalcularCartinhas.isPending ? "Recalculando…" : "Recalcular cartinhas"}
        </Button>
      </div>

      <FiltroCargo valor={filtro} onChange={setFiltro} total={perfis.length} />

      <div className="card-premium p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-display text-xl">Babas dos convidados</p>
          <Button variant="goldOutline" size="sm" onClick={() => setAjusteBabasAberto((v) => !v)}>
            <Trophy className="size-4" /> Ajustar babas
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O convidado precisa de 3 babas pagos para pedir associação. Se ele já jogou antes do app
          existir, registre aqui esse crédito para não precisar jogar 3 de novo.
        </p>

        {ajusteBabasAberto && (
          <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Convidado
              </Label>
              <Select value={ajusteBabasUserId} onValueChange={setAjusteBabasUserId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Escolha o convidado" />
                </SelectTrigger>
                <SelectContent>
                  {todos.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Babas que ele já jogou (crédito)
              </Label>
              <Input
                inputMode="numeric"
                placeholder="Ex.: 3"
                value={ajusteBabasValor}
                onChange={(e) => setAjusteBabasValor(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Observação (opcional)
              </Label>
              <Input
                placeholder="Ex.: jogou 3 babas antes do app"
                value={ajusteBabasObs}
                onChange={(e) => setAjusteBabasObs(e.target.value)}
                className="h-11"
              />
            </div>
            <Button
              variant="hero"
              className="w-full"
              disabled={!ajusteBabasUserId || salvarAjusteBabas.isPending}
              onClick={() => salvarAjusteBabas.mutate()}
            >
              <Trophy className="size-4" /> Salvar babas
            </Button>
          </div>
        )}

        {(ajustes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum ajuste registrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {(ajustes ?? []).map((a) => (
              <li
                key={a.usuario_id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {nomesUsuarios.get(a.usuario_id) ?? "Convidado"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {a.babas_credito} {a.babas_credito === 1 ? "baba" : "babas"} de crédito
                    {a.observacao ? ` • ${a.observacao}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="Remover ajuste de babas"
                  onClick={() => {
                    if (confirm("Remover esse ajuste de babas?"))
                      removerAjusteBabas.mutate(a.usuario_id);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="space-y-2">
        {perfis.map((p) => {
          const emEdicao = editando === p.id;
          return (
            <li key={p.id} className="card-premium p-4">
              {emEdicao ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor={`nome-${p.id}`}>Nome completo</Label>
                    <Input
                      id={`nome-${p.id}`}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`tel-${p.id}`}>WhatsApp</Label>
                    <Input
                      id={`tel-${p.id}`}
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`pos-${p.id}`}>Posição</Label>
                    <Select
                      value={posicao}
                      onValueChange={(v) => setPosicao(v as "linha" | "goleiro")}
                    >
                      <SelectTrigger id={`pos-${p.id}`} className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linha">Jogador de linha</SelectItem>
                        <SelectItem value="goleiro">Goleiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Atributos base da cartinha (pré-temporada) */}
                  <div className="space-y-2 rounded-xl border border-gold/25 bg-gold/5 p-3">
                    <Label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                      <SlidersHorizontal className="size-4 text-gold" /> Cartinha (pré-temporada)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Ajuste os atributos base manualmente. O sistema recalcula automaticamente
                      conforme os babas acontecem.
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {(
                        [
                          ["ovr", "OVR"],
                          ["ritmo", "PAC"],
                          ["finalizacao", "SHO"],
                          ["passe", "PAS"],
                          ["drible", "DRI"],
                          ["defesa", "DEF"],
                          ["fisico", "PHY"],
                        ] as const
                      ).map(([campo, rotulo]) => (
                        <div key={campo} className="space-y-0.5">
                          <Label
                            htmlFor={`${campo}-${p.id}`}
                            className="text-[9px] uppercase tracking-widest text-muted-foreground"
                          >
                            {rotulo}
                          </Label>
                          <Input
                            id={`${campo}-${p.id}`}
                            type="number"
                            min={1}
                            max={99}
                            value={atributos[campo]}
                            onChange={(e) =>
                              setAtributos((a) => ({
                                ...a,
                                [campo]: Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                              }))
                            }
                            className="h-10 px-2 text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="gold"
                      size="sm"
                      className="flex-1"
                      disabled={salvar.isPending}
                      onClick={() => salvar.mutate(p.id)}
                    >
                      <Save className="size-4" /> Salvar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditando(null)}>
                      <X className="size-4" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate font-semibold ${p.ativo ? "" : "text-muted-foreground line-through"}`}
                    >
                      {p.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.telefone ? formataTelefone(p.telefone) : "sem WhatsApp"} •{" "}
                      {p.posicao === "goleiro" ? "Goleiro" : "Linha"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="border-gold/40 text-gold capitalize">
                        {papelDe(p.id)}
                      </Badge>
                      {!p.ativo && <Badge variant="destructive">Inativo</Badge>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar cadastro de ${p.nome}`}
                    onClick={() => {
                      setEditando(p.id);
                      setNome(p.nome);
                      setTelefone(p.telefone ?? "");
                      setPosicao(p.posicao);
                      setAtributos({
                        ovr: p.ovr ?? 40,
                        ritmo: p.stat_ritmo ?? 40,
                        finalizacao: p.stat_finalizacao ?? 40,
                        passe: p.stat_passe ?? 40,
                        drible: p.stat_drible ?? 40,
                        defesa: p.stat_defesa ?? 40,
                        fisico: p.stat_fisico ?? 40,
                      });
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant={p.ativo ? "outline" : "success"}
                    size="icon"
                    aria-label={p.ativo ? `Desativar ${p.nome}` : `Reativar ${p.nome}`}
                    disabled={alternarAtivo.isPending}
                    onClick={() => alternarAtivo.mutate({ id: p.id, ativo: !p.ativo })}
                  >
                    <Power className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Remover ${p.nome} da lista do baba`}
                    disabled={!naLista(p.id) || removerDaLista.isPending}
                    onClick={() => removerDaLista.mutate(p.id)}
                  >
                    <UserMinus className="size-4" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Política de suspensões ajustável: limite/janela de faltas e duração das suspensões. */
function PoliticaSuspensaoCard() {
  const qc = useQueryClient();
  const { data: pol } = useQuery(politicaSuspensaoQuery());
  const [form, setForm] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState(false);

  const campos: {
    chave: string;
    rotulo: string;
    desc: string;
    atual: number;
    min: number;
    max: number;
  }[] = [
    {
      chave: "limite_faltas",
      rotulo: "Limite de faltas",
      desc: "Faltas em que o jogador é suspenso",
      atual: pol?.limiteFaltas ?? 3,
      min: 1,
      max: 20,
    },
    {
      chave: "janela_faltas",
      rotulo: "Janela (nº de babas)",
      desc: "Quantos babas recentes contam para o limite",
      atual: pol?.janelaFaltas ?? 5,
      min: 1,
      max: 30,
    },
    {
      chave: "suspensao_faltas_babas",
      rotulo: "Suspensão por faltas",
      desc: "Por quantos babas o faltoso fica fora (0 = desligado)",
      atual: pol?.suspensaoFaltasBabas ?? 1,
      min: 0,
      max: 10,
    },
    {
      chave: "suspensao_vermelho_babas",
      rotulo: "Suspensão por cartão vermelho",
      desc: "Por quantos babas o expulso fica fora (0 = desligado)",
      atual: pol?.suspensaoVermelhoBabas ?? 1,
      min: 0,
      max: 10,
    },
  ];

  const salvar = useMutation({
    mutationFn: async () => {
      const valores: Record<string, number> = {};
      for (const c of campos) {
        const raw = (form[c.chave] ?? "").trim();
        if (raw === "") continue;
        const v = Number(raw);
        if (!Number.isInteger(v) || v < c.min || v > c.max)
          throw new Error(`“${c.rotulo}” deve ser um inteiro entre ${c.min} e ${c.max}.`);
        valores[c.chave] = v;
      }
      const limite = valores.limite_faltas ?? pol?.limiteFaltas ?? 3;
      const janela = valores.janela_faltas ?? pol?.janelaFaltas ?? 5;
      if (janela < limite)
        throw new Error("A janela de babas não pode ser menor que o limite de faltas.");
      for (const [chave, valor] of Object.entries(valores)) {
        const { error } = await supabase
          .from("configuracoes")
          .upsert(
            { chave, valor, atualizado_em: new Date().toISOString() },
            { onConflict: "chave" },
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Política de suspensões atualizada", {
        description: "Os novos valores já valem para as próximas marcações.",
      });
      setConfirmando(false);
      setForm({});
      qc.invalidateQueries({ queryKey: ["politica-suspensao"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const sujo = campos.some((c) => (form[c.chave] ?? "").trim() !== "");

  return (
    <div className="card-premium p-5 space-y-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-gold" />
        <p className="font-display text-xl">Política de suspensões</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Tudo é ajustável: quantas faltas suspendem, em quantos babas e por quanto tempo vale cada
        suspensão. Vale para novas marcações (faltas e cartões) a partir de agora.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map((c) => (
          <div key={c.chave} className="space-y-1 rounded-lg border border-border bg-surface p-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              {c.rotulo}
            </Label>
            <p className="font-display text-2xl text-gold">{c.atual}</p>
            <p className="text-[11px] text-muted-foreground">{c.desc}</p>
            <Input
              inputMode="numeric"
              placeholder={`Novo valor (atual: ${c.atual})`}
              value={form[c.chave] ?? ""}
              onChange={(e) => {
                setForm((f) => ({ ...f, [c.chave]: e.target.value }));
                setConfirmando(false);
              }}
              className="h-10"
            />
          </div>
        ))}
      </div>
      <Button
        variant={confirmando ? "destructive" : "gold"}
        className="w-full"
        disabled={!sujo || salvar.isPending}
        onClick={() => (confirmando ? salvar.mutate() : setConfirmando(true))}
      >
        {confirmando ? "Confirmar" : "Salvar política"}
      </Button>
      {confirmando && (
        <p className="text-[11px] text-destructive">
          Confirme: a política será aplicada a partir das próximas marcações de falta e cartão.
        </p>
      )}
    </div>
  );
}
