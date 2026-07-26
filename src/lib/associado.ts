import { differenceInDays, differenceInMonths, differenceInYears, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Tempo de casa do associado, em linguagem de vestiário. */
export function tempoDeAssociado(criadoEm: string | undefined | null) {
  if (!criadoEm) return null;
  const desde = new Date(criadoEm);
  const agora = new Date();

  const anos = differenceInYears(agora, desde);
  const meses = differenceInMonths(agora, desde) - anos * 12;
  const dias = differenceInDays(agora, desde);

  let texto: string;
  if (anos >= 1) {
    texto = `${anos} ${anos === 1 ? "ano" : "anos"}${meses > 0 ? ` e ${meses} ${meses === 1 ? "mês" : "meses"}` : ""}`;
  } else if (differenceInMonths(agora, desde) >= 1) {
    const m = differenceInMonths(agora, desde);
    texto = `${m} ${m === 1 ? "mês" : "meses"}`;
  } else {
    texto = `${dias} ${dias === 1 ? "dia" : "dias"}`;
  }

  const apelido =
    anos >= 3
      ? "Ídolo da casa"
      : anos >= 1
        ? "Camisa 10 do baba"
        : differenceInMonths(agora, desde) >= 3
          ? "Titular absoluto"
          : "Reforço recém-chegado";

  return {
    texto,
    dias,
    desdeFormatado: format(desde, "MMMM 'de' yyyy", { locale: ptBR }),
    apelido,
  };
}
