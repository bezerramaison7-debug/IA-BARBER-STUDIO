import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site.config";
import { LegalBlock as Block, LegalPage } from "@/components/ui/legal";
import { isBookingSystemEnabled } from "@/lib/plan";
import { formatIsoDate } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: `Regras de uso do site da ${siteConfig.business.name}.`,
  alternates: { canonical: "/termos" },
};

const linkClass = "text-accent underline underline-offset-4";

/**
 * Termos de uso. As regras de agendamento e fidelidade descrevem o que o banco realmente aplica
 * (supabase/migrations). Prazos numéricos ficam no painel da barbearia, por isso o texto não os fixa.
 */
export default function TermsPage() {
  const { business, legal } = siteConfig;
  const accounts = isBookingSystemEnabled(siteConfig);

  return (
    <LegalPage title="Termos de uso" updated={formatIsoDate(legal.privacyUpdatedAt)} demo={siteConfig.demo}>
      <Block title="Sobre este site">
        <p>
          Este site apresenta os serviços da {business.name}
          {accounts ? " e permite consultar horários livres e pedir um horário pelo WhatsApp" : ""}. Preços e durações exibidos são uma
          referência e podem mudar. O valor final é combinado no atendimento. O site não faz cobranças nem
          recebe pagamentos.
        </p>
      </Block>

      {accounts && (
        <>
          <Block title="Como funciona o pedido de horário">
            <ul className="list-disc space-y-2 pl-6">
              <li>Não é preciso criar conta. Os horários mostrados são os livres no momento da consulta.</li>
              <li>
                Ao final, o site prepara uma mensagem para o WhatsApp da barbearia. Enviar a mensagem é um
                <strong> pedido</strong>, não uma reserva: o horário só fica garantido quando a barbearia{" "}
                <strong>confirmar</strong> pelo WhatsApp.
              </li>
              <li>
                Se o horário for ocupado antes da confirmação, a barbearia combina outro com você. Para desmarcar ou
                remarcar, fale com ela pelo WhatsApp.
              </li>
              <li>
                A barbearia pode remarcar ou cancelar um horário por motivo justificado (por exemplo, imprevisto com o
                profissional) e deve avisar você.
              </li>
            </ul>
          </Block>

          <Block title="Programa de fidelidade">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                A barbearia registra no próprio sistema cada atendimento concluído de um serviço participante, que vale
                um ponto no cartão correspondente. Os cartões são separados (corte e combo de cabelo e barba não se
                somam). Para consultar seu cartão, pergunte na barbearia: não há consulta pública por telefone.
              </li>
              <li>
                Ao completar o cartão, você ganha o serviço de recompensa (cortesia). Avise que quer usá-la ao combinar o
                horário. A cortesia é pessoal, não pode ser trocada por dinheiro nem transferida, e cancelamentos, faltas
                e cortesias não contam pontos.
              </li>
              <li>
                Pontos só contam depois que o atendimento é marcado como concluído pela barbearia. Se a conclusão
                for desfeita, o ponto também é retirado.
              </li>
              <li>
                Faltar a um horário marcado com recompensa pode fazer você perder a recompensa, conforme a regra
                definida pela barbearia.
              </li>
              <li>
                A barbearia pode mudar ou encerrar o programa com aviso prévio. Pontos e recompensas já conquistados
                continuam valendo.
              </li>
            </ul>
          </Block>
        </>
      )}

      <Block title="Dados pessoais">
        <p>
          O tratamento de dados segue a nossa{" "}
          <Link href="/privacidade" className={linkClass}>Política de privacidade</Link> e a{" "}
          <Link href="/cookies" className={linkClass}>Política de cookies</Link>.
        </p>
      </Block>

      <Block title="Contato">
        <p>
          Dúvidas sobre estes termos:{" "}
          <a href={`mailto:${legal.privacyEmail}`} className={linkClass}>{legal.privacyEmail}</a>.
        </p>
      </Block>
    </LegalPage>
  );
}
