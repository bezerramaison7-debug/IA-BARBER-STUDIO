import Image from "next/image";
import type { SiteTexts } from "@/config/texts";
import type { SiteConfig } from "@/config/types";
import Link from "next/link";
import { buttonClasses, LinkButton } from "@/components/ui/button";
import { ONLINE_BOOKING_HREF } from "@/lib/navigation";
import { WhatsAppIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/section";
import { getWhatsAppNumber, getWhatsAppUrl } from "@/lib/site";
import { BookingForm } from "./booking-form";

interface BookingProps {
  config: SiteConfig;
  texts: SiteTexts;
  /** Premium: formulário de solicitação. Essencial: bloco com botão de WhatsApp. */
  withForm: boolean;
  /** V3: agendamento online com conta; a seção leva ao fluxo /agendar. */
  onlineBooking?: boolean;
}

export function Booking({ config, texts, withForm, onlineBooking = false }: BookingProps) {
  if (onlineBooking) return <OnlineBookingCta config={config} texts={texts} />;
  const t = withForm ? texts.booking : texts.whatsappCta;

  return (
    <section id="agendar" aria-labelledby="agendar-titulo" className="bg-surface py-20 sm:py-28">
      <Container className={withForm ? "grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20" : "grid items-center gap-12 lg:grid-cols-2"}>
        <div>
          <h2
            id="agendar-titulo"
            className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-6xl"
          >
            {t.title}
          </h2>
          <p className="mt-5 max-w-md text-lg text-muted">{withForm ? texts.booking.intro : texts.whatsappCta.text}</p>

          {withForm ? (
            <ol className="mt-10 space-y-6">
              {texts.booking.steps.map((step, i) => (
                <li key={step} className="flex gap-5">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-accent font-display text-xl font-bold text-accent"
                  >
                    {i + 1}
                  </span>
                  <p className="pt-1.5">{step}</p>
                </li>
              ))}
            </ol>
          ) : (
            <LinkButton href={getWhatsAppUrl(config)} external className="mt-8">
              <WhatsAppIcon className="text-xl" /> {texts.whatsappCta.button}
            </LinkButton>
          )}

          {withForm && (
            <div className="relative mt-12 hidden aspect-3/2 overflow-hidden rounded-sm lg:block">
              <Image src={config.images.booking.src} alt={config.images.booking.alt} fill sizes="40vw" className="object-cover" />
            </div>
          )}
        </div>

        {withForm ? (
          <div className="rounded-sm border border-line bg-background p-5 sm:p-10">
            <BookingForm
              whatsapp={getWhatsAppNumber(config)}
              greeting={config.booking.greeting}
              periods={config.booking.periods}
              demo={config.demo}
              labels={texts.booking}
              fromLabel={texts.pricing.fromLabel}
              services={config.services.map(({ id, name, price, priceFrom, durationMinutes }) => ({
                id,
                name,
                price,
                priceFrom,
                durationMinutes,
              }))}
              professionals={config.team.map(({ id, name }) => ({ id, name }))}
            />
          </div>
        ) : (
          <div className="relative aspect-3/2 overflow-hidden rounded-sm">
            <Image
              src={config.images.booking.src}
              alt={config.images.booking.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        )}
      </Container>
    </section>
  );
}

/** V3: convite ao agendamento online (horários reais, conta e confirmação pela barbearia). */
function OnlineBookingCta({ config, texts }: { config: SiteConfig; texts: SiteTexts }) {
  const t = texts.onlineBooking;
  return (
    <section id="agendar" aria-labelledby="agendar-titulo" className="bg-surface py-20 sm:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 id="agendar-titulo" className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-6xl">
            {t.title}
          </h2>
          <p className="mt-5 max-w-md text-lg text-muted">{t.text}</p>
          <ol className="mt-8 space-y-4">
            {t.steps.map((step, i) => (
              <li key={step} className="flex gap-4">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-accent font-display text-lg font-bold text-accent">
                  {i + 1}
                </span>
                <p className="pt-1">{step}</p>
              </li>
            ))}
          </ol>
          <Link href={ONLINE_BOOKING_HREF} className={buttonClasses("primary", "mt-8")}>
            {t.button}
          </Link>
        </div>
        <div className="relative aspect-3/2 overflow-hidden rounded-sm">
          <Image src={config.images.booking.src} alt={config.images.booking.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
      </Container>
    </section>
  );
}
