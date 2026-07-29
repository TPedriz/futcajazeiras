import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todosAssociadosQuery, papeisTodosQuery, proximaSessaoQuery, presencasDaSessaoQuery } from "@/lib/babaQueries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FiltroCargo, type FiltroPapel } from "@/components/FiltroCargo";
import { toast } from "sonner";
import { useState } from "react";
import { formataTelefone, normalizaTelefone } from "@/lib/telefone";
import { Pencil, UserMinus, Save, X, Power } from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const { data: todos } = useSuspenseQuery(todosAssociadosQuery());
  const { data: papeis } = useQuery(papeisTodosQuery());
  const { data: sessao } = useQuery(proximaSessaoQuery());
  const { data: presencas } = useQuery(presencasDaSessaoQuery(sessao?.id));
  const qc = useQueryClient();

  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [posicao, setPosicao] = useState<"linha" | "goleiro">("linha");
  const [filtro, setFiltro] = useState<FiltroPapel>("todos");

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

  const naLista = (id: string) =>
    (presencas ?? []).some((p) => p.usuario_id === id && !p.nome_convidado);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-gold">Cadastros</p>
        <h2 className="font-display text-2xl">Usuários</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edite nome, WhatsApp e posição de qualquer pessoa, e tire quem quiser da lista do próximo baba.
        </p>
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
                    <p className="truncate font-semibold">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.telefone ? formataTelefone(p.telefone) : "sem WhatsApp"} • {p.posicao === "goleiro" ? "Goleiro" : "Linha"}
                    </p>
                    <Badge variant="outline" className="mt-1 border-gold/40 text-gold capitalize">
                      {papelDe(p.id)}
                    </Badge>
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
