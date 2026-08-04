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
} from "@/lib/babaQueries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FiltroCargo, type FiltroPapel } from "@/components/FiltroCargo";
import { AprovacoesConvidados } from "@/components/AprovacoesConvidados";
import { toast } from "sonner";
import { useState } from "react";
import { formataTelefone, normalizaTelefone } from "@/lib/telefone";
import { Pencil, UserMinus, Save, X, Power, Gavel } from "lucide-react";
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
  const qc = useQueryClient();

  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [posicao, setPosicao] = useState<"linha" | "goleiro">("linha");
  const [filtro, setFiltro] = useState<FiltroPapel>("todos");
  const [aplicandoPunicao, setAplicandoPunicao] = useState(false);
  const [punicaoUserId, setPunicaoUserId] = useState("");
  const [punicaoBabaId, setPunicaoBabaId] = useState("");
  const [punicaoMotivo, setPunicaoMotivo] = useState("");

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
        .update({ nome: nome.trim(), telefone: normalizaTelefone(telefone), posicao })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cadastro atualizado");
      setEditando(null);
      qc.invalidateQueries({ queryKey: ["associados-todos"] });
      qc.invalidateQueries({ queryKey: ["perfis-publicos"] });
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
          <Button
            variant="goldOutline"
            size="sm"
            onClick={() => setAplicandoPunicao((v) => !v)}
          >
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
              disabled={
                !punicaoUserId || !punicaoBabaId || aplicarPunicao.isPending
              }
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
                    Bloqueado em {s.baba_bloqueado_id ? nomesBabas.get(s.baba_bloqueado_id) : "próximo baba"}{" "}
                    • {s.motivo}
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

      <FiltroCargo valor={filtro} onChange={setFiltro} total={perfis.length} />

      <ul className="space-y-2">

        {perfis.map((p) => {
          const emEdicao = editando === p.id;
          return (
            <li key={p.id} className="card-premium p-4">
              {emEdicao ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor={`nome-${p.id}`}>Nome completo</Label>
                    <Input id={`nome-${p.id}`} value={nome} onChange={(e) => setNome(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`tel-${p.id}`}>WhatsApp</Label>
                    <Input id={`tel-${p.id}`} value={telefone} onChange={(e) => setTelefone(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`pos-${p.id}`}>Posição</Label>
                    <Select value={posicao} onValueChange={(v) => setPosicao(v as "linha" | "goleiro")}>
                      <SelectTrigger id={`pos-${p.id}`} className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linha">Jogador de linha</SelectItem>
                        <SelectItem value="goleiro">Goleiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="gold" size="sm" className="flex-1" disabled={salvar.isPending} onClick={() => salvar.mutate(p.id)}>
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
                    <p className={`truncate font-semibold ${p.ativo ? "" : "text-muted-foreground line-through"}`}>
                      {p.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.telefone ? formataTelefone(p.telefone) : "sem WhatsApp"} • {p.posicao === "goleiro" ? "Goleiro" : "Linha"}
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
