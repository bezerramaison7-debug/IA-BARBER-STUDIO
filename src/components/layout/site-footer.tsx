import Link from "next/link";
import type { SiteTexts } from "@/config/texts";
import type { SiteConfig } from "@/config/types";
import { Container } from "@/components/ui/section";
import type { NavLink } from "@/lib/navigation";
import { getFullAddress } from "@/lib/site";
import { SocialLinks } from "./social-links";

/** "A, B e C" a partir de uma lista. */
function joinCities(cities: string[]): string {
  return cities.length <= 1 ? (cities[0] ?? "") : `${cities.slice(0, -1).join(", ")} e ${cities.at(-1)}`;
}

interface SiteFooterProps {
  config: SiteConfig;
  texts: SiteTexts;
  links: NavLink[];
}

export function SiteFooter({ config, texts, links }: SiteFooterProps) {
  return (
    <footer className="border-t border-line bg-background pt-16 pb-28 sm:pb-16">
      <Container className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-4xl font-extrabold uppercase">{config.business.name}</p>
          <p className="mt-3 max-w-sm text-muted">{config.business.tagline}</p>
          <SocialLinks social={config.social} newTabLabel={texts.newTab} className="mt-6" />
        </div>

        <nav aria-label="Rodapé">
          <p className="font-semibold">{texts.footer.navTitle}</p>
          <ul className="mt-2 text-muted">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-11 items-center hover:text-accent">
                  {link.label}
                </Link>
              </li>
            ))}
            {[
              ["/privacidade", texts.footer.privacy],
              ["/cookies", texts.footer.cookies],
              ["/termos", texts.footer.terms],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center hover:text-accent">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="font-semibold">{texts.footer.addressTitle}</p>
          <address className="mt-4 text-muted not-italic">{getFullAddress(config)}</address>
          <p className="mt-4 text-sm text-muted">
            {texts.footer.serviceAreaPrefix} {joinCities(config.serviceArea)}.
          </p>
        </div>
      </Container>

      <Container className="mt-14 flex flex-col gap-2 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:justify-between">
        <p>
          © {config.business.name}
          {config.demo && ". Conteúdo demonstrativo e fictício."}
        </p>
        {config.demo && <p>Fotos ilustrativas: Unsplash.</p>}
      </Container>
    </footer>
  );
}
