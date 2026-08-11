import { Github, Instagram, Linkedin } from "lucide-react";

/** Versão atual do site — incremente a cada release (1.0.27 = 27º PR). */
export const VERSAO_APP = "1.0.34";

const DEV = {
  nome: "Thiago Pedriz",
  instagram: "https://www.instagram.com/offthype",
  github: "https://github.com/TPedriz",
  linkedin: "https://www.linkedin.com/in/thiagopedriz/",
};

/** Rodapé com versão do sistema e créditos do desenvolvedor. */
export function RodapeApp({ transparente = false }: { transparente?: boolean }) {
  return (
    <footer
      className={`border-t border-border/50 ${transparente ? "bg-background/50" : "bg-surface"}`}
    >
      <div className="mx-auto max-w-md px-4 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Fut Cajazeiras — Todos os direitos reservados
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Versão <strong className="text-gold">{VERSAO_APP}</strong>
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span>Desenvolvido por</span>
          <span className="font-semibold text-foreground">{DEV.nome}</span>
          <a
            href={DEV.instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram do desenvolvedor"
            className="text-muted-foreground transition-colors hover:text-gold"
          >
            <Instagram className="size-4" />
          </a>
          <a
            href={DEV.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub do desenvolvedor"
            className="text-muted-foreground transition-colors hover:text-gold"
          >
            <Github className="size-4" />
          </a>
          <a
            href={DEV.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn do desenvolvedor"
            className="text-muted-foreground transition-colors hover:text-gold"
          >
            <Linkedin className="size-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
