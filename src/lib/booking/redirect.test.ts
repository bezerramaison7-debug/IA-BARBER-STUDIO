import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("destino depois do login", () => {
  it("aceita caminhos do próprio site, com busca", () => {
    expect(safeNext("/agendar?servico=degrade&hora=x")).toBe("/agendar?servico=degrade&hora=x");
    expect(safeNext(null)).toBe("/minha-conta");
  });

  it("recusa outros sites, inclusive com truques de barra e caracteres de controle", () => {
    for (const evil of ["https://outro.com", "//outro.com", "/\\outro.com", "/\t/outro.com", "/\n/outro.com", "/%09/outro.com", "javascript:alert(1)"]) {
      const result = safeNext(evil);
      expect(new URL(result, "https://site.com.br").origin, evil).toBe("https://site.com.br");
    }
  });
});
