import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  todasSessoesQuery,
  locaisBabaQuery,
  fechamentoPadrao,
  fechamentoEfetivo,
  aberturaPadrao,
  aberturaEfetivo,
} from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { BadgeBaxvi } from "@/components/BadgeBaxvi";
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
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  MapPin,
  Lock,
  Unlock,
  Trash2,
  Eye,
  EyeOff,
  Navigation,
  Pencil,
  Plus,
  Save,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todasSessoesQuery()),
  component: AdminSessoes,
});

function AdminSessoes() {
  const { data: sessoes } = useSuspenseQuery(todasSessoesQuery());
  const { data: locais } = useQuery(locaisBabaQuery());
  const qc = useQueryClient();

  const [dataHorario, setDataHorario] = useState("");
  const [local, setLocal] = useState("Arena Cajazeiras");
  const [lat, setLat] = useState("-12.898243032071784");
  const [lng, setLng] = useState("-38.39820393037823");
  const [raio, setRaio] = useState("1000");
  const [tipo, setTipo] = useState<"comum" | "baxvi">("comum");

  const [mostrarNovoLocal, setMostrarNovoLocal] = useState(false);
  const [novoLocal, setNovoLocal] = useState({
    nome: "",
    latitude: "",
    longitude: "",
    raio: "1000",
  });
  const [editLocalId, setEditLocalId] = useState<string | null>(null);
  const [editLocal, setEditLocal] = useState({
    nome: "",
    latitude: "",
    longitude: "",
    raio: "1000",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    data_horario: "",
    local: "",
    lat: "",
    lng: "",
    raio: "",
    abertura: "",
    fechamento: "",
    tipo: "comum" as "comum" | "baxvi",
  });

  const iniciarEdicao = (s: (typeof sessoes)[number]) => {
    setEditingId(s.id);
    setEditForm({
      data_horario: format(new Date(s.data_horario), "yyyy-MM-dd'T'HH:mm"),
      local: s.local,
      lat: String(s.latitude ?? ""),
      lng: String(s.longitude ?? ""),
      raio: String(s.raio_metros ?? ""),
      abertura: format(aberturaEfetivo(s), "yyyy-MM-dd'T'HH:mm"),
      fechamento: format(fechamentoEfetivo(s), "yyyy-MM-dd'T'HH:mm"),
      tipo: (s.tipo as "comum" | "baxvi") ?? "comum",
    });
  };

  const salvarEdicao = useMutation({
    mutationFn: async (id: string) => {
      if (!editForm.data_horario) throw new Error("Informe data e horário");
      const { error } = await supabase
        .from("sessoes_baba")
        .update({
          data_horario: new Date(editForm.data_horario).toISOString(),
          local: editForm.local,
          latitude: Number(editForm.lat),
          longitude: Number(editForm.lng),
          raio_metros: Math.max(100, Number(editForm.raio) || 1000),
          tipo: editForm.tipo,
          abertura_lista: editForm.abertura ? new Date(editForm.abertura).toISOString() : null,
          fechamento_lista: editForm.fechamento
            ? new Date(editForm.fechamento).toISOString()
            : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Baba atualizado!");
      setEditingId(null);
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const invalidarLocais = () => qc.invalidateQueries({ queryKey: ["locais-baba"] });

  const criarLocal = useMutation({
    mutationFn: async () => {
      if (!novoLocal.nome.trim()) throw new Error("Informe o nome do local");
      const { error } = await supabase.from("locais_baba").insert({
        nome: novoLocal.nome.trim(),
        latitude: Number(novoLocal.latitude),
        longitude: Number(novoLocal.longitude),
        raio_metros: Math.max(100, Number(novoLocal.raio) || 1000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Local salvo!");
      setNovoLocal({ nome: "", latitude: "", longitude: "", raio: "1000" });
      setMostrarNovoLocal(false);
      invalidarLocais();
    },
    onError: (e: Error) => toast.error("Erro ao salvar local", { description: e.message }),
  });

  const iniciarEdicaoLocal = (l: NonNullable<typeof locais>[number]) => {
    setEditLocalId(l.id);
    setEditLocal({
      nome: l.nome,
      latitude: String(l.latitude),
      longitude: String(l.longitude),
      raio: String(l.raio_metros),
    });
  };

  const atualizarLocal = useMutation({
    mutationFn: async (id: string) => {
      if (!editLocal.nome.trim()) throw new Error("Informe o nome do local");
      const { error } = await supabase
        .from("locais_baba")
        .update({
          nome: editLocal.nome.trim(),
          latitude: Number(editLocal.latitude),
          longitude: Number(editLocal.longitude),
          raio_metros: Math.max(100, Number(editLocal.raio) || 1000),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Local atualizado!");
      setEditLocalId(null);
      invalidarLocais();
    },
    onError: (e: Error) => toast.error("Erro ao atualizar local", { description: e.message }),
  });

  const excluirLocal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locais_baba").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Local excluído");
      invalidarLocais();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  /** Aplica um local salvo nos campos do baba (nome, GPS e raio). */
  const aplicarLocal = (id: string) => {
    const l = (locais ?? []).find((x) => x.id === id);
    if (!l) return;
    setLocal(l.nome);
    setLat(String(l.latitude));
    setLng(String(l.longitude));
    setRaio(String(l.raio_metros));
  };

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["sessoes-todas"] });
    qc.invalidateQueries({ queryKey: ["proxima-sessao"] });
  };

  const usarMinhaLocalizacao = () => {
    if (!("geolocation" in navigator))
      return toast.error("Localização indisponível neste aparelho");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast.success("Coordenadas da arena atualizadas");
      },
      () => toast.error("Não foi possível ler o GPS"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!dataHorario) throw new Error("Informe data e horário");
      const jogo = new Date(dataHorario);
      const fechamento = fechamentoPadrao(jogo);
      const abertura = aberturaPadrao(jogo);
      const { error } = await supabase.from("sessoes_baba").insert({
        data_horario: jogo.toISOString(),
        local,
        tipo,
        fechamento_lista: fechamento.toISOString(),
        abertura_lista: abertura.toISOString(),
        latitude: Number(lat),
        longitude: Number(lng),
        raio_metros: Math.max(100, Number(raio) || 1000),
      });
      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Baba criado!");
      setDataHorario("");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const toggleFechado = useMutation({
    mutationFn: async ({ id, fechado }: { id: string; fechado: boolean }) => {
      const { error } = await supabase
        .from("sessoes_baba")
        .update({ esta_fechado: fechado })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      invalidar();
    },
  });

  const toggleLista = useMutation({
    mutationFn: async ({ id, mostrar }: { id: string; mostrar: boolean }) => {
      const { error } = await supabase
        .from("sessoes_baba")
        .update({ mostrar_lista_chegada: mostrar })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visibilidade da lista atualizada");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const alterarFechamento = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: string }) => {
      const { error } = await supabase
        .from("sessoes_baba")
        .update({ fechamento_lista: valor })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fechamento da lista atualizado");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const alterarAbertura = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: string }) => {
      const { error } = await supabase
        .from("sessoes_baba")
        .update({ abertura_lista: valor })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Abertura da lista atualizado");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sessoes_baba").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Baba excluído");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  return (
    <div className="space-y-5">
      <div className="card-premium p-5 space-y-3">
        <p className="font-display text-xl">Novo baba</p>
        <div>
          <Label htmlFor="dt">Data e horário</Label>
          <Input
            id="dt"
            type="datetime-local"
            value={dataHorario}
            onChange={(e) => setDataHorario(e.target.value)}
            className="h-12"
          />
        </div>
        <div>
          <Label htmlFor="loc-salvo">Local salvo</Label>
          <Select onValueChange={aplicarLocal}>
            <SelectTrigger id="loc-salvo" className="h-12">
              <SelectValue placeholder="Escolher endereço salvo…" />
            </SelectTrigger>
            <SelectContent>
              {(locais ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="loc">Local</Label>
          <Input
            id="loc"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="h-12"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="h-12"
              inputMode="decimal"
            />
          </div>
          <div>
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="h-12"
              inputMode="decimal"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="raio">Raio do check-in (metros)</Label>
          <Input
            id="raio"
            value={raio}
            onChange={(e) => setRaio(e.target.value)}
            className="h-12"
            inputMode="numeric"
          />
        </div>
        <div>
          <Label htmlFor="tipo-baba">Tipo de baba</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as "comum" | "baxvi")}>
            <SelectTrigger id="tipo-baba" className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comum">Baba comum</SelectItem>
              <SelectItem value="baxvi">BAxVI (Bahia × Vitória)</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            BAxVI = clássico Bahia × Vitória. Os times são montados pela diretoria na aba Sorteio,
            escolhendo os relacionados de cada time — como no Brasileirão.
          </p>
        </div>
        <Button variant="goldOutline" size="lg" className="w-full" onClick={usarMinhaLocalizacao}>
          <Navigation className="size-4" /> Usar minha localização atual
        </Button>
        <p className="text-xs text-muted-foreground">
          A lista abre às 22h do dia anterior e fecha 3h antes do jogo — e pode ser ajustada no
          histórico. O check-in presencial abre 30 min antes, encerra 1h após o início e só funciona
          dentro do raio definido.
        </p>
        <Button
          variant="hero"
          size="lg"
          className="w-full"
          onClick={() => criar.mutate()}
          disabled={criar.isPending}
        >
          Criar baba
        </Button>
      </div>

      <div className="card-premium p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-display text-xl">Locais de baba</p>
          <Button variant="goldOutline" size="sm" onClick={() => setMostrarNovoLocal((v) => !v)}>
            <Plus className="size-4" /> Novo local
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Endereços fixos (GPS + raio) para reutilizar ao criar um baba.
        </p>
        {mostrarNovoLocal && (
          <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
            <Input
              placeholder="Nome (ex.: Arena Cajazeiras)"
              value={novoLocal.nome}
              onChange={(e) => setNovoLocal({ ...novoLocal, nome: e.target.value })}
              className="h-10"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Latitude"
                inputMode="decimal"
                value={novoLocal.latitude}
                onChange={(e) => setNovoLocal({ ...novoLocal, latitude: e.target.value })}
                className="h-10"
              />
              <Input
                placeholder="Longitude"
                inputMode="decimal"
                value={novoLocal.longitude}
                onChange={(e) => setNovoLocal({ ...novoLocal, longitude: e.target.value })}
                className="h-10"
              />
            </div>
            <Input
              placeholder="Raio (metros)"
              inputMode="numeric"
              value={novoLocal.raio}
              onChange={(e) => setNovoLocal({ ...novoLocal, raio: e.target.value })}
              className="h-10"
            />
            <Button
              variant="hero"
              className="w-full"
              disabled={criarLocal.isPending}
              onClick={() => criarLocal.mutate()}
            >
              <Save className="size-4" /> Salvar local
            </Button>
          </div>
        )}
        {(locais ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum local salvo ainda.</p>
        ) : (
          <ul className="space-y-2">
            {(locais ?? []).map((l) => (
              <li key={l.id} className="rounded-lg border border-border bg-surface p-3">
                {editLocalId === l.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editLocal.nome}
                      onChange={(e) => setEditLocal({ ...editLocal, nome: e.target.value })}
                      className="h-10"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        inputMode="decimal"
                        value={editLocal.latitude}
                        onChange={(e) => setEditLocal({ ...editLocal, latitude: e.target.value })}
                        className="h-10"
                      />
                      <Input
                        inputMode="decimal"
                        value={editLocal.longitude}
                        onChange={(e) => setEditLocal({ ...editLocal, longitude: e.target.value })}
                        className="h-10"
                      />
                    </div>
                    <Input
                      inputMode="numeric"
                      value={editLocal.raio}
                      onChange={(e) => setEditLocal({ ...editLocal, raio: e.target.value })}
                      className="h-10"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="hero"
                        size="sm"
                        className="flex-1"
                        disabled={atualizarLocal.isPending}
                        onClick={() => atualizarLocal.mutate(l.id)}
                      >
                        <Save className="size-4" /> Salvar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditLocalId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <MapPin className="size-4 shrink-0 text-gold" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{l.nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {l.latitude.toFixed(6)}, {l.longitude.toFixed(6)} • raio {l.raio_metros} m
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar local"
                      onClick={() => iniciarEdicaoLocal(l)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label="Excluir local"
                      onClick={() => {
                        if (confirm(`Excluir o local "${l.nome}"?`)) excluirLocal.mutate(l.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-3 font-display text-xl">Histórico</p>
        {sessoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum baba cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {sessoes.map((s) => (
              <li key={s.id} className="card-premium p-4">
                {editingId === s.id ? (
                  <div className="space-y-3">
                    <p className="font-display text-lg">Editando baba</p>
                    <div>
                      <Label htmlFor={`e-dt-${s.id}`}>Data e horário</Label>
                      <Input
                        id={`e-dt-${s.id}`}
                        type="datetime-local"
                        className="h-10"
                        value={editForm.data_horario}
                        onChange={(e) => setEditForm({ ...editForm, data_horario: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`e-loc-${s.id}`}>Local</Label>
                      <Input
                        id={`e-loc-${s.id}`}
                        className="h-10"
                        value={editForm.local}
                        onChange={(e) => setEditForm({ ...editForm, local: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor={`e-lat-${s.id}`}>Latitude</Label>
                        <Input
                          id={`e-lat-${s.id}`}
                          className="h-10"
                          inputMode="decimal"
                          value={editForm.lat}
                          onChange={(e) => setEditForm({ ...editForm, lat: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`e-lng-${s.id}`}>Longitude</Label>
                        <Input
                          id={`e-lng-${s.id}`}
                          className="h-10"
                          inputMode="decimal"
                          value={editForm.lng}
                          onChange={(e) => setEditForm({ ...editForm, lng: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`e-raio-${s.id}`}>Raio do check-in (metros)</Label>
                      <Input
                        id={`e-raio-${s.id}`}
                        className="h-10"
                        inputMode="numeric"
                        value={editForm.raio}
                        onChange={(e) => setEditForm({ ...editForm, raio: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`e-tipo-${s.id}`}>Tipo de baba</Label>
                      <Select
                        value={editForm.tipo}
                        onValueChange={(v) =>
                          setEditForm({ ...editForm, tipo: v as "comum" | "baxvi" })
                        }
                      >
                        <SelectTrigger id={`e-tipo-${s.id}`} className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comum">Baba comum</SelectItem>
                          <SelectItem value="baxvi">BAxVI (Bahia × Vitória)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor={`e-abert-${s.id}`}>Abertura da lista</Label>
                        <Input
                          id={`e-abert-${s.id}`}
                          type="datetime-local"
                          className="h-10"
                          value={editForm.abertura}
                          onChange={(e) => setEditForm({ ...editForm, abertura: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`e-fech-${s.id}`}>Fechamento da lista</Label>
                        <Input
                          id={`e-fech-${s.id}`}
                          type="datetime-local"
                          className="h-10"
                          value={editForm.fechamento}
                          onChange={(e) => setEditForm({ ...editForm, fechamento: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="hero"
                        className="flex-1"
                        disabled={salvarEdicao.isPending}
                        onClick={() => salvarEdicao.mutate(s.id)}
                      >
                        Salvar
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <Calendar className="size-4 text-gold" />
                        {format(new Date(s.data_horario), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                        {s.tipo === "baxvi" && <BadgeBaxvi />}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {s.local}
                      </div>
                      <div className="mt-2">
                        <Label
                          htmlFor={`abert-${s.id}`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Abertura da lista
                        </Label>
                        <Input
                          id={`abert-${s.id}`}
                          type="datetime-local"
                          className="h-10"
                          defaultValue={format(aberturaEfetivo(s), "yyyy-MM-dd'T'HH:mm")}
                          onBlur={(e) =>
                            e.target.value &&
                            alterarAbertura.mutate({
                              id: s.id,
                              valor: new Date(e.target.value).toISOString(),
                            })
                          }
                        />
                      </div>
                      <div className="mt-2">
                        <Label
                          htmlFor={`fech-${s.id}`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Fechamento da lista
                        </Label>
                        <Input
                          id={`fech-${s.id}`}
                          type="datetime-local"
                          className="h-10"
                          defaultValue={format(fechamentoEfetivo(s), "yyyy-MM-dd'T'HH:mm")}
                          onBlur={(e) =>
                            e.target.value &&
                            alterarFechamento.mutate({
                              id: s.id,
                              valor: new Date(e.target.value).toISOString(),
                            })
                          }
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.esta_fechado && (
                          <span className="rounded bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-destructive">
                            Fechado
                          </span>
                        )}
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {s.mostrar_lista_chegada ? "Lista visível" : "Lista oculta"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar baba"
                        onClick={() => iniciarEdicao(s)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={
                          s.mostrar_lista_chegada
                            ? "Ocultar lista de chegada"
                            : "Mostrar lista de chegada"
                        }
                        onClick={() =>
                          toggleLista.mutate({ id: s.id, mostrar: !s.mostrar_lista_chegada })
                        }
                      >
                        {s.mostrar_lista_chegada ? (
                          <Eye className="size-4" />
                        ) : (
                          <EyeOff className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={
                          s.esta_fechado ? "Reabrir lista do baba" : "Fechar lista do baba"
                        }
                        onClick={() => toggleFechado.mutate({ id: s.id, fechado: !s.esta_fechado })}
                      >
                        {s.esta_fechado ? (
                          <Unlock className="size-4" />
                        ) : (
                          <Lock className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label="Excluir baba"
                        onClick={() => {
                          if (
                            confirm(
                              "Excluir esta partida? Presenças, times e estatísticas dela serão apagados.",
                            )
                          ) {
                            excluir.mutate(s.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
