import Link from "next/link";
import Image from "next/image";
import type { SiteTexts } from "@/config/texts";
import type { SiteConfig } from "@/config/types";
import { buttonClasses } from "@/components/ui/button";
import { ClockIcon, MapPinIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/section";
import { getBookingHref } from "@/lib/navigation";
import { isBookingSystemEnabled } from "@/lib/plan";
import { OpenStatus } from "./open-status";

export function Hero({ config, texts }: { config: SiteConfig; texts: SiteTexts }) {
  const { business, images, address } = config;

  return (
    <section id="inicio" aria-labelledby="inicio-titulo" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden md:max-lg:min-h-[min(100svh,52rem)]">
      <Image
        src={images.hero.src}
        alt={images.hero.alt}
        fill
        priority
        sizes="100vw"
        className="animate-settle -z-20 object-cover object-[70%_center]"
      />
      {/* Escurece a foto do lado do texto para garantir contraste. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-black via-black/70 to-black/30 md:bg-linear-to-r md:from-black md:via-black/75 md:to-black/10"
      />

      <Container className="flex flex-1 flex-col justify-end pt-40 pb-10 sm:pb-14">
        <h1 id="inicio-titulo" className="animate-rise max-w-4xl">
          <span className="block text-lg text-foreground/85 sm:text-xl">{business.tagline}</span>
          <span className="mt-2 block font-display text-[clamp(4.25rem,15vw,11.5rem)] leading-[0.82] font-extrabold tracking-tight uppercase">
            {business.name}
          </span>
        </h1>

        <p className="animate-rise mt-8 max-w-xl text-lg leading-relaxed text-foreground/80 [animation-delay:150ms] sm:text-xl">
          {business.description}
        </p>

        <div className="animate-rise mt-10 flex flex-col gap-3 [animation-delay:300ms] sm:flex-row sm:gap-4">
          <Link href={getBookingHref(isBookingSystemEnabled(config))} className={buttonClasses("primary")}>
            {texts.hero.primaryCta}
          </Link>
          <Link href="/#precos" className={buttonClasses("outline")}>
            {texts.hero.secondaryCta}
          </Link>
        </div>

        <dl className="animate-rise mt-14 grid gap-4 border-t border-foreground/20 pt-6 text-sm text-foreground/80 [animation-delay:450ms] sm:grid-cols-2 sm:text-base">
          <div className="flex items-center gap-3">
            <dt>
              <ClockIcon className="text-lg text-accent" />
              <span className="sr-only">{texts.hero.hoursLabel}</span>
            </dt>
            <dd className="min-h-6">
              <OpenStatus hours={config.hours} timeZone={config.timeZone} />
            </dd>
          </div>
          <div className="flex items-center gap-3">
            <dt>
              <MapPinIcon className="text-lg text-accent" />
              <span className="sr-only">{texts.hero.addressLabel}</span>
            </dt>
            <dd>
              {address.street}, {address.neighborhood}, {address.city}/{address.state}
            </dd>
          </div>
        </dl>
      </Container>
    </section>
  );
}
