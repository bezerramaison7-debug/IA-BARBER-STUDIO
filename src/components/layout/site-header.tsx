"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import type { NavLink } from "@/lib/navigation";

interface SiteHeaderProps {
  name: string;
  demo: boolean;
  links: NavLink[];
  bookingHref: string;
  labels: { booking: string; menuOpen: string; menuClose: string };
  /** V3: link para a área do cliente (só com o agendamento online ativo). */
  account?: { href: string; label: string };
}

export function SiteHeader({ name, demo, links, bookingHref, labels, account }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Menu móvel: Esc fecha e a página de fundo não rola enquanto ele está aberto.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const solid = scrolled || menuOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        solid ? "border-b border-line bg-background/95 backdrop-blur" : "bg-transparent"
      }`}
    >
      {demo && (
        <p className="bg-accent px-4 py-1.5 text-center text-xs font-semibold text-accent-foreground">
          Site demonstrativo<span className="max-sm:hidden">: nomes, preços, endereço e contatos são fictícios</span>
          <span className="sm:hidden"> com dados fictícios</span>.
        </p>
      )}

      <div className="mx-auto flex h-(--header-height) w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/#inicio" className="font-display text-2xl font-extrabold tracking-tight whitespace-nowrap uppercase">
          {name}
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-[0.95rem]">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-foreground/80 transition-colors hover:text-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          {account && (
            <Link href={account.href} className="inline-flex min-h-11 items-center px-2 font-semibold text-foreground/80 hover:text-accent max-sm:hidden">
              {account.label}
            </Link>
          )}
          <Link href={bookingHref} className={buttonClasses("primary", "min-h-11 px-5 max-sm:hidden")}>
            {labels.booking}
          </Link>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center text-2xl lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="menu-movel"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
            <span className="sr-only">{menuOpen ? labels.menuClose : labels.menuOpen}</span>
          </button>
        </div>
      </div>

      <nav
        id="menu-movel"
        aria-label="Principal"
        hidden={!menuOpen}
        className="h-[calc(100dvh-var(--header-height))] overflow-y-auto border-t border-line bg-background px-5 pb-10 lg:hidden"
      >
        <ul className="divide-y divide-line">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block py-5 font-display text-4xl font-bold uppercase"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        {account && (
          <Link href={account.href} onClick={() => setMenuOpen(false)} className="block py-5 font-display text-4xl font-bold uppercase">
            {account.label}
          </Link>
        )}
        <Link
          href={bookingHref}
          onClick={() => setMenuOpen(false)}
          className={buttonClasses("primary", "mt-8 w-full")}
        >
          {labels.booking}
        </Link>
      </nav>
    </header>
  );
}
