import { useCartinha } from "@/components/CartinhaModal";

/**
 * Nome de um jogador clicável: abre o modal com a cartinha dele.
 * Se `usuarioId` for ausente (convidado sem conta), renderiza texto puro.
 */
export function NomeJogadorCartinha({
  nome,
  usuarioId,
  className = "",
}: {
  nome: string;
  usuarioId?: string | null;
  className?: string;
}) {
  const { abrirCartinha } = useCartinha();

  if (!usuarioId) {
    return <span className={className}>{nome}</span>;
  }

  return (
    <button
      type="button"
      title={`Ver cartinha de ${nome}`}
      className={`cursor-pointer text-left underline-offset-4 transition-colors hover:text-gold hover:underline ${className}`}
      onClick={() => abrirCartinha(usuarioId)}
    >
      {nome}
    </button>
  );
}
