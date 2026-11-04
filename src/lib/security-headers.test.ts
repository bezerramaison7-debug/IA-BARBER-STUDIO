import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./security-headers";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `));

describe("Content-Security-Policy", () => {
  it("sem Supabase, o navegador só conversa com o próprio site", () => {
    const csp = buildContentSecurityPolicy(null);
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'self'");
  });

  it("com Supabase, libera só a origem do projeto (HTTP e WebSocket)", () => {
    const csp = buildContentSecurityPolicy("https://abcd.supabase.co");
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
  });

  it("permite o iframe do Google Maps e nenhum outro", () => {
    expect(directive(buildContentSecurityPolicy(), "frame-src")).toBe("frame-src https://www.google.com https://maps.google.com");
  });
});
