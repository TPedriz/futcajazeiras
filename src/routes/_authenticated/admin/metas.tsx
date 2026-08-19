import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { metasQuery, contribuicoesMetaQuery } from "@/lib/babaQueries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Save,
  X,
  Pencil,
  Lock,
  CheckCircle2,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Shirt,
  UserRound,
  CreditCard,
} from "lucide-react";
import {
  formatarArrecadacaoItemParaWhatsApp,
  formatarReais,
  progressoMeta,
  rotuloCategoriaMeta,
  rotuloStatusMeta,
  rotuloTipoArrecadacao,
} from "@/lib/redeSocial";
import { AvatarJogador } from "@/components/AvatarJogador";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Meta = Database["public"]["Tables"]["metas"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/metas")({
  component: AdminMetas,
});

const CATEGORIAS = [
  "material_esportivo",
  "eventos",
  "resenha",
  "infraestrutura",
  "uniforme",
  "outros",
];
const STATUS = ["ativa", "encerrada", "atingida"];

const FORM_VAZIO = {
  titulo: "",
  descricao: "",
  valor_alvo: "",
  prazo: "",
  categoria: "outros",
  status: "ativa",
  tipo_arrecadacao: "aberta",
  valor_item: "",
  prazo_cadastro: "",
  prazo_pagamento: "",
};

function AdminMetas() {
  const qc = useQueryClient();
  const { data: metas, isLoading, isError } = useQuery(metasQuery());

  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...FORM_VAZIO });
  const [historico, setHistorico] = useState<string | null>(null);

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["metas"] });
    void qc.invalidateQueries({ queryKey: ["contribuicoes-meta"] });
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) {
        throw new Error("Preencha o título da meta.");
      }
      if (form.tipo_arrecadacao === "item" && !form.valor_item) {
        throw new Error("Informe o valor por item.");
      }
      const { data, error } = await supabase.rpc("criar_meta_admin", {
        p_titulo: form.titulo.trim(),
        p_descricao: form.descricao.trim(),
        p_valor_alvo: form.valor_alvo ? Number(form.valor_alvo) : undefined,
        p_prazo: form.prazo || undefined,
        p_categoria: form.categoria,
        p_tipo_arrecadacao: form.tipo_arrecadacao,
        p_valor_item: form.valor_item ? Number(form.valor_item) : undefined,
        p_prazo_cadastro: form.prazo_cadastro || undefined,
        p_prazo_pagamento: form.prazo_pagamento || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Meta criada! Um evento foi gerado no feed.");
      setForm({ ...FORM_VAZIO });
      setCriando(false);
      invalidar();
    },
    onError: (e: Error) => toast.error("Não foi possível criar a meta", { description: e.message }),
  });

  const salvarEdicao = useMutation({
    mutationFn: async () => {
      if (!editandoId) return;
      const { error } = await supabase.rpc("atualizar_meta_admin", {
        p_meta_id: editandoId,
        p_titulo: editForm.titulo.trim(),
        p_descricao: editForm.descricao.trim(),
        p_valor_alvo: editForm.valor_alvo ? Number(editForm.valor_alvo) : undefined,
        p_prazo: editForm.prazo || undefined,
        p_categoria: editForm.categoria,
        p_status: editForm.status,
        p_tipo_arrecadacao: editForm.tipo_arrecadacao,
        p_valor_item: editForm.valor_item ? Number(editForm.valor_item) : undefined,
        p_prazo_cadastro: editForm.prazo_cadastro || undefined,
        p_prazo_pagamento: editForm.prazo_pagamento || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta atualizada!");
      setEditandoId(null);
      invalidar();
    },
    onError: (e: Error) =>
      toast.error("Não foi possível atualizar a meta", { description: e.message }),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc("atualizar_meta_admin", {
        p_meta_id: id,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      invalidar();
    },
    onError: () => toast.error("Não foi possível atualizar o status."),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta excluída.");
      invalidar();
    },
    onError: () => toast.error("Não foi possível excluir a meta."),
  });

  const iniciarEdicao = (m: Meta) => {
    setEditandoId(m.id);
    setEditForm({
      titulo: m.titulo,
      descricao: m.descricao,
      valor_alvo: String(m.valor_alvo ?? ""),
      prazo: m.prazo ?? "",
      categoria: m.categoria,
      status: m.status,
      tipo_arrecadacao: m.tipo_arrecadacao ?? "aberta",
      valor_item: m.valor_item != null ? String(m.valor_item) : "",
      prazo_cadastro: m.prazo_cadastro ?? "",
      prazo_pagamento: m.prazo_pagamento ?? "",
    });
  };

  return (
    <div className="space-y-5">
      {/* Formulário de criação */}
      <div className="card-premium space-y-3 p-4">
        <button
          type="button"
          onClick={() => setCriando((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold"
        >
          {criando ? <X className="size-4" /> : <Plus className="size-4" />}
          {criando ? "Cancelar" : "Nova meta"}
        </button>

        {criando && (
          <div className="space-y-3 border-t border-border pt-3">
            <FormCampos form={form} setForm={(u) => setForm((p) => ({ ...p, ...u }))} />
            <div className="flex gap-2">
              <Button
                variant="gold"
                className="flex-1"
                disabled={criar.isPending}
                onClick={() => criar.mutate()}
              >
                {criar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Criar meta
              </Button>
              <Button variant="outline" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="card-premium space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">
          Metas ({isLoading ? "…" : (metas ?? []).length})
        </p>

        {isError && <p className="text-sm text-destructive">Não foi possível carregar as metas.</p>}
        {!isLoading && !isError && (metas ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
        )}

        <div className="space-y-2">
          {(metas ?? []).map((m) => {
            const prog = progressoMeta(m.valor_arrecadado, m.valor_alvo);
            return editandoId === m.id ? (
              <div key={m.id} className="space-y-3 rounded-xl border border-gold/40 bg-gold/5 p-3">
                <FormCampos form={editForm} setForm={(u) => setEditForm((p) => ({ ...p, ...u }))} />
                <div className="flex gap-2">
                  <Button
                    variant="gold"
                    size="sm"
                    className="flex-1"
                    disabled={salvarEdicao.isPending}
                    onClick={() => salvarEdicao.mutate()}
                  >
                    <Save className="size-4" /> Salvar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div key={m.id} className="rounded-xl border border-border/60 bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{m.titulo}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 uppercase tracking-widest text-muted-foreground">
                        {rotuloCategoriaMeta(m.categoria)}
                      </span>
                      <span className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 uppercase tracking-widest text-muted-foreground">
                        {rotuloTipoArrecadacao(m.tipo_arrecadacao)}
                      </span>
                      <span className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 uppercase tracking-widest text-muted-foreground">
                        {rotuloStatusMeta(m.status)}
                      </span>
                    </div>

                    {m.tipo_arrecadacao === "item" ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="font-semibold text-gold">
                          {formatarReais(m.valor_item)} / item
                        </span>
                        <ResumoItemMeta metaId={m.id} />
                        <span className="text-muted-foreground">
                          Arrecadado {formatarReais(prog.arrecadado)}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        <span className="font-semibold text-gold">
                          {formatarReais(prog.arrecadado)}
                        </span>
                        <span className="text-muted-foreground">/ {formatarReais(prog.alvo)}</span>
                        <span className="text-muted-foreground">({prog.percentual}%)</span>
                      </div>
                    )}

                    {(m.valor_alvo ?? 0) > 0 && (
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full bg-gold"
                          style={{ width: `${prog.percentual}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {m.tipo_arrecadacao === "item" && <BotaoExportarWhatsApp meta={m} />}
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9"
                      aria-label="Editar"
                      onClick={() => iniciarEdicao(m)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {m.status === "ativa" && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9"
                        aria-label="Encerrar meta"
                        onClick={() => mudarStatus.mutate({ id: m.id, status: "encerrada" })}
                      >
                        <Lock className="size-3.5" />
                      </Button>
                    )}
                    {m.status !== "atingida" && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9"
                        aria-label="Marcar como atingida"
                        onClick={() => mudarStatus.mutate({ id: m.id, status: "atingida" })}
                      >
                        <CheckCircle2 className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9"
                      aria-label="Excluir"
                      onClick={() => excluir.mutate(m.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Histórico de contribuições */}
                <button
                  type="button"
                  onClick={() => setHistorico(historico === m.id ? null : m.id)}
                  className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  aria-expanded={historico === m.id}
                >
                  Ver contribuições
                  {historico === m.id ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </button>
                {historico === m.id && (
                  <ContribuicoesAdmin metaId={m.id} tipoArrecadacao={m.tipo_arrecadacao} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Contadores de cadastrados/pagos de uma meta por item (painel admin). */
function ResumoItemMeta({ metaId }: { metaId: string }) {
  const { data: contribuicoes } = useQuery(contribuicoesMetaQuery(metaId));
  const lista = contribuicoes ?? [];
  const pagos = lista.filter((c) => c.status === "confirmada").length;
  const cadastrados = lista.filter(
    (c) => c.status === "pendente" || c.status === "confirmada",
  ).length;
  return (
    <>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <UserRound className="size-3.5" /> {cadastrados} cadastrados
      </span>
      <span className="inline-flex items-center gap-1 text-success">
        <CreditCard className="size-3.5" /> {pagos} pagos
      </span>
    </>
  );
}

/** Histórico de contribuições de uma meta (painel admin). */
function ContribuicoesAdmin({
  metaId,
  tipoArrecadacao,
}: {
  metaId: string;
  tipoArrecadacao: string;
}) {
  const { data: contribuicoes } = useQuery(contribuicoesMetaQuery(metaId));
  const ehItem = tipoArrecadacao === "item";

  // Para item, mostra todos os cadastros (pendentes e pagos) com a personalização.
  const visiveis = ehItem
    ? (contribuicoes ?? []).filter((c) => c.status === "pendente" || c.status === "confirmada")
    : (contribuicoes ?? []).filter((c) => c.status === "confirmada");

  if (visiveis.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {ehItem ? "Nenhum cadastro ainda." : "Nenhuma contribuição confirmada."}
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      {visiveis.map((c) => {
        const pago = c.status === "confirmada";
        return (
          <div
            key={c.id}
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-2"
          >
            <AvatarJogador
              caminho={c.perfis_publicos?.avatar_url}
              nome={c.perfis_publicos?.nome}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {c.anonima ? "Anônima" : (c.perfis_publicos?.nome ?? "Jogador")}
              </p>
              {ehItem && c.nome_camisa && (
                <p className="truncate text-[10px] text-muted-foreground">
                  Camisa "{c.nome_camisa}" · {c.tamanho} · #{c.numero_camisa}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(c.confirmada_em ?? c.criado_em), "dd/MM/yyyy HH:mm", {
                  locale: ptBR,
                })}{" "}
                · {pago ? "PAGO" : "PENDENTE"}
              </p>
            </div>
            <span className="text-sm font-semibold text-gold">{formatarReais(c.valor)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Botão que copia a lista de cadastrados/pagos para o WhatsApp (igual ao sorteio). */
function BotaoExportarWhatsApp({ meta }: { meta: Meta }) {
  const { data: contribuicoes } = useQuery(contribuicoesMetaQuery(meta.id));
  const [copiando, setCopiando] = useState(false);

  const exportar = async () => {
    const lista = (contribuicoes ?? []).filter(
      (c) => c.status === "pendente" || c.status === "confirmada",
    );
    const texto = formatarArrecadacaoItemParaWhatsApp(
      {
        titulo: meta.titulo,
        categoria: meta.categoria,
        valor_item: meta.valor_item,
        valor_alvo: meta.valor_alvo,
        valor_arrecadado: meta.valor_arrecadado,
        prazo_cadastro: meta.prazo_cadastro,
        prazo_pagamento: meta.prazo_pagamento,
      },
      lista.map((c) => ({
        id: c.id,
        nome: c.anonima ? "Anônima" : (c.perfis_publicos?.nome ?? "Jogador"),
        nome_camisa: c.nome_camisa,
        tamanho: c.tamanho,
        numero_camisa: c.numero_camisa,
        status: c.status,
      })),
    );
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado! Cole no grupo do WhatsApp.", {
        description: `${lista.filter((c) => c.status === "confirmada").length} pagos · ${
          lista.filter((c) => c.status === "pendente").length
        } pendentes`,
      });
    } catch {
      setCopiando(true);
      toast.error("Não foi possível copiar", { description: "Selecione o texto manualmente." });
      setCopiando(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-9"
      aria-label="Exportar para WhatsApp"
      title="Exportar para WhatsApp"
      disabled={copiando}
      onClick={() => void exportar()}
    >
      <Copy className="size-3.5 text-gold" />
    </Button>
  );
}

function FormCampos({
  form,
  setForm,
}: {
  form: typeof FORM_VAZIO;
  setForm: (u: Partial<typeof FORM_VAZIO>) => void;
}) {
  const ehItem = form.tipo_arrecadacao === "item";

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="meta-titulo">Título *</Label>
          <Input
            id="meta-titulo"
            value={form.titulo}
            onChange={(e) => setForm({ titulo: e.target.value })}
            placeholder="Coletes individuais"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="meta-tipo">Tipo de arrecadação</Label>
          <Select
            value={form.tipo_arrecadacao}
            onValueChange={(v) => setForm({ tipo_arrecadacao: v })}
          >
            <SelectTrigger id="meta-tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aberta">Aberta (valor livre)</SelectItem>
              <SelectItem value="item">Por item (custo fixo)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {ehItem ? (
          <div className="space-y-1">
            <Label htmlFor="meta-valor-item">Valor por item (R$) *</Label>
            <Input
              id="meta-valor-item"
              type="number"
              min={1}
              step="0.01"
              value={form.valor_item}
              onChange={(e) => setForm({ valor_item: e.target.value })}
              placeholder="71"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="meta-alvo">Valor alvo (R$) *</Label>
            <Input
              id="meta-alvo"
              type="number"
              min={1}
              step="0.01"
              value={form.valor_alvo}
              onChange={(e) => setForm({ valor_alvo: e.target.value })}
              placeholder="1500"
            />
          </div>
        )}

        {ehItem ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="meta-prazo-cadastro">Prazo de cadastro</Label>
              <Input
                id="meta-prazo-cadastro"
                type="date"
                value={form.prazo_cadastro}
                onChange={(e) => setForm({ prazo_cadastro: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="meta-prazo-pagamento">Prazo de pagamento</Label>
              <Input
                id="meta-prazo-pagamento"
                type="date"
                value={form.prazo_pagamento}
                onChange={(e) => setForm({ prazo_pagamento: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="meta-prazo">Prazo</Label>
            <Input
              id="meta-prazo"
              type="date"
              value={form.prazo}
              onChange={(e) => setForm({ prazo: e.target.value })}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="meta-categoria">Categoria</Label>
          <Select value={form.categoria} onValueChange={(v) => setForm({ categoria: v })}>
            <SelectTrigger id="meta-categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {rotuloCategoriaMeta(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="meta-status">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ status: v })}>
            <SelectTrigger id="meta-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {rotuloStatusMeta(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="meta-descricao">Descrição</Label>
        <Textarea
          id="meta-descricao"
          value={form.descricao}
          onChange={(e) => setForm({ descricao: e.target.value })}
          placeholder="Para que serve esta meta?"
          rows={2}
        />
      </div>
    </>
  );
}
