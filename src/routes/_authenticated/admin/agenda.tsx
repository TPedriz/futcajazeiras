import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { agendaEventosQuery } from "@/lib/babaQueries";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Save, X, Pencil, Trash2, CalendarOff, CheckCircle2, Loader2 } from "lucide-react";
import { rotuloCategoriaEvento, rotuloStatusEvento, formatarHora } from "@/lib/redeSocial";
import type { Database } from "@/integrations/supabase/types";

type EventoArena = Database["public"]["Tables"]["arena_eventos"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/agenda")({
  component: AdminAgenda,
});

const CATEGORIAS = ["baba", "evento", "outro"];
const STATUS = ["agendado", "cancelado", "concluido"];

const FORM_VAZIO = {
  titulo: "",
  data_evento: "",
  hora_inicio: "",
  hora_fim: "",
  organizador: "Fut Cajazeiras",
  descricao: "",
  categoria: "baba",
  status: "agendado",
  local: "Arena Cajazeiras",
  vagas: "",
};

function AdminAgenda() {
  const qc = useQueryClient();
  const { data: eventos, isLoading, isError } = useQuery(agendaEventosQuery());

  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...FORM_VAZIO });

  const invalidar = () => void qc.invalidateQueries({ queryKey: ["agenda-eventos"] });

  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim() || !form.data_evento || !form.hora_inicio) {
        throw new Error("Preencha título, data e horário.");
      }
      const { error } = await supabase.from("arena_eventos").insert({
        titulo: form.titulo.trim(),
        data_evento: form.data_evento,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim || null,
        organizador: form.organizador.trim() || "Fut Cajazeiras",
        descricao: form.descricao.trim(),
        categoria: form.categoria,
        status: form.status,
        local: form.local.trim() || "Arena Cajazeiras",
        vagas: form.vagas ? Number(form.vagas) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento criado!");
      setForm({ ...FORM_VAZIO });
      setCriando(false);
      invalidar();
    },
    onError: (e: Error) =>
      toast.error("Não foi possível criar o evento", { description: e.message }),
  });

  const salvarEdicao = useMutation({
    mutationFn: async () => {
      if (!editandoId) return;
      if (!editForm.titulo.trim() || !editForm.data_evento || !editForm.hora_inicio) {
        throw new Error("Preencha título, data e horário.");
      }
      const { error } = await supabase
        .from("arena_eventos")
        .update({
          titulo: editForm.titulo.trim(),
          data_evento: editForm.data_evento,
          hora_inicio: editForm.hora_inicio,
          hora_fim: editForm.hora_fim || null,
          organizador: editForm.organizador.trim() || "Fut Cajazeiras",
          descricao: editForm.descricao.trim(),
          categoria: editForm.categoria,
          status: editForm.status,
          local: editForm.local.trim() || "Arena Cajazeiras",
          vagas: editForm.vagas ? Number(editForm.vagas) : null,
        })
        .eq("id", editandoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento atualizado!");
      setEditandoId(null);
      invalidar();
    },
    onError: (e: Error) =>
      toast.error("Não foi possível atualizar o evento", { description: e.message }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("arena_eventos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento excluído.");
      invalidar();
    },
    onError: () => toast.error("Não foi possível excluir o evento."),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("arena_eventos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      invalidar();
    },
    onError: () => toast.error("Não foi possível atualizar o status."),
  });

  const iniciarEdicao = (e: EventoArena) => {
    setEditandoId(e.id);
    setEditForm({
      titulo: e.titulo,
      data_evento: e.data_evento,
      hora_inicio: e.hora_inicio,
      hora_fim: e.hora_fim ?? "",
      organizador: e.organizador,
      descricao: e.descricao,
      categoria: e.categoria,
      status: e.status,
      local: e.local,
      vagas: e.vagas != null ? String(e.vagas) : "",
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
          {criando ? "Cancelar" : "Novo evento na agenda"}
        </button>

        {criando && (
          <div className="space-y-3 border-t border-border pt-3">
            <FormCampos
              form={form}
              setForm={(updater) => setForm((prev) => ({ ...prev, ...updater }))}
            />
            <div className="flex gap-2">
              <Button
                variant="gold"
                className="flex-1"
                disabled={criarMutation.isPending}
                onClick={() => criarMutation.mutate()}
              >
                {criarMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Criar evento
              </Button>
              <Button variant="outline" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de eventos */}
      <div className="card-premium space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">
          Eventos ({isLoading ? "…" : (eventos ?? []).length})
        </p>

        {isError && <p className="text-sm text-destructive">Não foi possível carregar a agenda.</p>}

        {!isLoading && !isError && (eventos ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum evento cadastrado ainda.</p>
        )}

        <div className="space-y-2">
          {(eventos ?? []).map((e) =>
            editandoId === e.id ? (
              <div key={e.id} className="space-y-3 rounded-xl border border-gold/40 bg-gold/5 p-3">
                <FormCampos
                  form={editForm}
                  setForm={(updater) => setEditForm((prev) => ({ ...prev, ...updater }))}
                />
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
              <div
                key={e.id}
                className={`rounded-xl border border-border/60 bg-surface p-3 ${e.status === "cancelado" ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{e.titulo}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {format(
                        new Date(`${e.data_evento}T12:00:00`),
                        "EEEE, dd 'de' MMMM 'de' yyyy",
                        {
                          locale: ptBR,
                        },
                      )}{" "}
                      • {formatarHora(e.hora_inicio)}
                      {e.hora_fim ? `–${formatarHora(e.hora_fim)}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 uppercase tracking-widest text-muted-foreground">
                        {rotuloCategoriaEvento(e.categoria)}
                      </span>
                      <span className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 uppercase tracking-widest text-muted-foreground">
                        {rotuloStatusEvento(e.status)}
                      </span>
                      <span className="text-muted-foreground">{e.local}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9"
                      aria-label="Editar"
                      onClick={() => iniciarEdicao(e)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {e.status !== "cancelado" && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9"
                        aria-label="Cancelar evento"
                        onClick={() => mudarStatus.mutate({ id: e.id, status: "cancelado" })}
                      >
                        <CalendarOff className="size-3.5" />
                      </Button>
                    )}
                    {e.status !== "concluido" && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9"
                        aria-label="Marcar como concluído"
                        onClick={() => mudarStatus.mutate({ id: e.id, status: "concluido" })}
                      >
                        <CheckCircle2 className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9"
                      aria-label="Excluir"
                      onClick={() => excluir.mutate(e.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

/** Campos reutilizáveis do formulário (criação e edição). */
function FormCampos({
  form,
  setForm,
}: {
  form: typeof FORM_VAZIO;
  setForm: (u: Partial<typeof FORM_VAZIO>) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ev-titulo">Título *</Label>
          <Input
            id="ev-titulo"
            value={form.titulo}
            onChange={(e) => setForm({ titulo: e.target.value })}
            placeholder="Baba dos Amigos"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ev-organizador">Organizador</Label>
          <Input
            id="ev-organizador"
            value={form.organizador}
            onChange={(e) => setForm({ organizador: e.target.value })}
            placeholder="Fut Cajazeiras"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ev-data">Data *</Label>
          <Input
            id="ev-data"
            type="date"
            value={form.data_evento}
            onChange={(e) => setForm({ data_evento: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="ev-inicio">Início *</Label>
            <Input
              id="ev-inicio"
              type="time"
              value={form.hora_inicio}
              onChange={(e) => setForm({ hora_inicio: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-fim">Fim</Label>
            <Input
              id="ev-fim"
              type="time"
              value={form.hora_fim}
              onChange={(e) => setForm({ hora_fim: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ev-local">Local</Label>
          <Input
            id="ev-local"
            value={form.local}
            onChange={(e) => setForm({ local: e.target.value })}
            placeholder="Arena Cajazeiras"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="ev-categoria">Categoria</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm({ categoria: v })}>
              <SelectTrigger id="ev-categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {rotuloCategoriaEvento(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-status">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ status: v })}>
              <SelectTrigger id="ev-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {rotuloStatusEvento(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ev-vagas">Vagas (opcional)</Label>
          <Input
            id="ev-vagas"
            type="number"
            min={1}
            value={form.vagas}
            onChange={(e) => setForm({ vagas: e.target.value })}
            placeholder="20"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ev-descricao">Descrição</Label>
        <Textarea
          id="ev-descricao"
          value={form.descricao}
          onChange={(e) => setForm({ descricao: e.target.value })}
          placeholder="Informações adicionais do evento..."
          rows={2}
        />
      </div>
    </>
  );
}
