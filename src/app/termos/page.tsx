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
          {accounts ? " e permite solicitar horários online" : ""}. Preços e durações exibidos são uma
          referência e podem mudar. O valor final é combinado no atendimento. O site não faz cobranças nem
          recebe pagamentos.
        </p>
      </Block>

      {accounts && (
        <>
          <Block title="Sua conta">
            <ul className="list-disc space-y-2 pl-6">
              <li>A conta é pessoal. Use dados verdadeiros e mantenha a senha em segredo.</li>
              <li>É preciso confirmar o e-mail antes de solicitar o primeiro horário.</li>
              <li>
                Para proteger a agenda, há limites de pedidos em aberto e de tentativas por hora. Uso abusivo (como
                reservar horários sem intenção de comparecer) pode levar a barbearia a cancelar os pedidos.
              </li>
            </ul>
          </Block>

          <Block title="Como funciona o agendamento">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Ao solicitar, seu pedido fica <strong>pendente</strong> e o horário é reservado para você. Ele só
                está garantido quando a barbearia <strong>confirmar</strong>.
              </li>
              <li>
                Enviar a mensagem pelo WhatsApp é opcional e não confirma o horário: a confirmação é feita pela
                barbearia e aparece em Minha conta.
              </li>
              <li>Pedidos não confirmados no prazo definido pela barbearia expiram e o horário volta a ficar livre.</li>
              <li>
                Você pode cancelar ou remarcar em Minha conta até a antecedência mínima definida pela barbearia.
                Depois disso, fale com ela pelo WhatsApp.
              </li>
              <li>
                A barbearia pode remarcar ou cancelar um horário por motivo justificado (por exemplo, imprevisto
                com o profissional) e deve avisar você.
              </li>
            </ul>
          </Block>

          <Block title="Programa de fidelidade">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Cada atendimento concluído de um serviço participante vale um ponto no cartão correspondente. Os
                cartões são separados (por exemplo, corte e combo de cabelo e barba não se somam).
              </li>
              <li>
                Ao completar o cartão, você ganha o serviço de recompensa, que é escolhido ao solicitar um horário.
                A recompensa é pessoal, não pode ser trocada por dinheiro nem transferida.
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
