import type { ReactNode } from "react";
import { Container } from "./section";

/** Seção de uma página legal (privacidade, cookies, termos). */
export function LegalBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-3xl font-bold uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** Casca comum das páginas legais: título, data de revisão e aviso de texto-modelo na demo. */
export function LegalPage({ title, updated, demo, children }: { title: string; updated: string; demo: boolean; children: ReactNode }) {
  return (
    <Container className="max-w-3xl pt-40 pb-24">
      <h1 className="font-display text-6xl leading-[0.9] font-extrabold uppercase">{title}</h1>
      <p className="mt-4 text-muted">Atualizada em {updated}.</p>
      {demo && (
        <p className="mt-8 border-l-2 border-accent pl-4 text-muted">
          Texto-modelo de demonstração. Para um cliente real, revise com o responsável pelo estabelecimento
          antes de publicar.
        </p>
      )}
      <div className="mt-12 space-y-12 text-lg leading-relaxed text-foreground/85">{children}</div>
    </Container>
  );
}
