import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site.config";
import { LegalBlock as Block, LegalPage } from "@/components/ui/legal";
import { getFeatures, isBookingSystemEnabled } from "@/lib/plan";
import { formatIsoDate } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Privacidade",
  description: `Como o site da ${siteConfig.business.name} trata dados pessoais.`,
  alternates: { canonical: "/privacidade" },
};

const linkClass = "text-accent underline underline-offset-4";

/**
 * Política de privacidade montada a partir do comportamento real do site.
 * Sem o sistema de agendamento (planos essencial/premium ou sem Supabase): sem cadastro, sem cookies,
 * sem armazenamento no navegador e sem análise. Com o sistema (plano profissional + Supabase): conta,
 * agendamentos, fidelidade e a sessão guardada no navegador. Recurso novo que trate dados = rever esta página.
 */
export default function PrivacyPage() {
  const { business, legal } = siteConfig;
  const features = getFeatures(siteConfig);
  const accounts = isBookingSystemEnabled(siteConfig);
  const hosting = legal.hostingProvider ?? "Vercel";
  const email = legal.emailProvider ?? "o serviço de envio de e-mail contratado pela barbearia";

  return (
    <LegalPage title="Privacidade" updated={formatIsoDate(legal.privacyUpdatedAt)} demo={siteConfig.demo}>
      <Block title="Quem é o responsável">
        <p>
          Este site é da {business.name}. O responsável pelo tratamento de dados pessoais (controlador) é{" "}
          {legal.controllerName}
          {legal.document ? `, ${legal.document}` : ""}.
        </p>
      </Block>

      {accounts ? (
        <>
          <Block title="O que coletamos">
            <p>Para você agendar online, pedimos uma conta com apenas quatro dados:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>nome completo, para identificar o atendimento;</li>
              <li>telefone com DDD, para a barbearia falar com você sobre o horário;</li>
              <li>e-mail, para entrar na conta, confirmá-la e recuperar a senha;</li>
              <li>senha, guardada apenas de forma cifrada (nem a barbearia consegue lê-la).</li>
            </ul>
            <p>
              Ao usar o sistema, registramos também seus agendamentos (serviço, profissional, data, horário,
              situação e observações que você escrever), o histórico do programa de fidelidade e a data em que
              você aceitou ou recusou receber novidades. Não pedimos CPF, endereço, data de nascimento ou foto.
            </p>
          </Block>

          <Block title="Para que usamos e com que base legal">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Conta, agendamentos e fidelidade: para prestar o serviço que você pediu (LGPD, art. 7º, V).
              </li>
              <li>
                Registros de segurança (tentativas de acesso, alterações feitas no painel da barbearia e limite
                de pedidos): para proteger sua conta e evitar abuso, por interesse legítimo (art. 7º, IX).
              </li>
              <li>
                Novidades e promoções: só se você marcar essa opção, que vem desmarcada. Você pode desmarcar a
                qualquer momento em Minha conta (consentimento, art. 7º, I).
              </li>
            </ul>
            <p>Não vendemos dados, não usamos para publicidade de terceiros e não fazemos perfis automatizados.</p>
          </Block>

          <Block title="Quem trata os dados conosco">
            <p>Estes serviços processam dados em nome da barbearia (operadores), só para fazer o sistema funcionar:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Supabase: banco de dados e login;</li>
              <li>{hosting}: hospedagem do site;</li>
              <li>{email}: envio dos e-mails de confirmação de conta e de troca de senha.</li>
            </ul>
            <p>
              Esses serviços podem manter servidores fora do Brasil. Nesse caso, a transferência segue as
              garantias contratuais deles (LGPD, art. 33). Somente pessoas autorizadas da barbearia acessam o
              painel, e cada consulta à ficha de um cliente fica registrada.
            </p>
          </Block>

          <Block title="Por quanto tempo guardamos">
            <ul className="list-disc space-y-2 pl-6">
              <li>Dados da conta: enquanto a conta existir.</li>
              <li>
                Pedidos de horário não confirmados expiram sozinhos no prazo definido pela barbearia, e o horário
                volta a ficar livre.
              </li>
              <li>
                Se você pedir a exclusão, nome, telefone e e-mail são apagados ou anonimizados. Ficam apenas
                registros sem identificação (por exemplo, que houve um corte em certa data), necessários para a
                agenda e para estatísticas internas, além do que a lei obrigar a guardar.
              </li>
            </ul>
          </Block>

          <Block title="No seu navegador">
            <p>
              Para manter você conectado, o site guarda a sessão de login no armazenamento local do navegador.
              Esse registro é estritamente necessário para a conta funcionar e é apagado quando você sai. Não
              usamos cookies de estatística, publicidade ou rastreamento. Detalhes em{" "}
              <Link href="/cookies" className={linkClass}>Cookies</Link>.
            </p>
          </Block>
        </>
      ) : (
        <Block title="O que o site coleta">
          <p>
            Nada é coletado pelo próprio site: não há cadastro, login, cookies, armazenamento no seu
            navegador nem ferramentas de estatística ou publicidade.
          </p>
        </Block>
      )}

      <Block title="WhatsApp">
        <p>
          {accounts
            ? "Depois de solicitar um horário, você pode abrir o WhatsApp com uma mensagem pronta (protocolo, serviço, data e horário). Abrir o WhatsApp não confirma o horário: a confirmação é feita pela barbearia no sistema."
            : features.bookingForm
              ? "O formulário de agendamento não envia nada para este site. O que você escreve fica no seu navegador até você tocar em enviar; nesse momento o WhatsApp abre com a mensagem pronta, e você decide se envia."
              : "Os botões de WhatsApp abrem o aplicativo com uma mensagem pronta, e você decide se envia."}{" "}
          O WhatsApp é um serviço da Meta, com política de privacidade própria. As mensagens recebidas são
          usadas pela {business.name} apenas para responder e agendar o atendimento que você pediu (LGPD,
          art. 7º, V).
        </p>
      </Block>

      <Block title="Mapa">
        <p>
          O mapa da página de contato vem do Google Maps e só é carregado quando você toca em “Mostrar mapa”.
          Antes disso, o site não se conecta ao Google. Depois, valem as regras de privacidade do Google.
        </p>
      </Block>

      <Block title="Hospedagem e links externos">
        <p>
          O site é hospedado pela {hosting}, que registra dados técnicos de acesso (como endereço IP,
          navegador e página visitada) para manter o serviço funcionando e seguro. Links para redes sociais
          levam a sites de terceiros, com políticas próprias.
        </p>
      </Block>

      <Block title="Seus direitos">
        <p>
          Pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018, art. 18), você pode pedir a confirmação
          de que tratamos seus dados, acesso, correção, portabilidade, anonimização ou eliminação, informações
          sobre com quem eles são compartilhados e revogar um consentimento dado.
        </p>
        {accounts && (
          <p>
            Em <Link href="/minha-conta" className={linkClass}>Minha conta</Link> você corrige seus dados, baixa
            uma cópia deles e faz pedidos de privacidade (como a exclusão da conta). A barbearia responde em
            até 15 dias.
          </p>
        )}
        <p>
          Pedidos e dúvidas:{" "}
          <a href={`mailto:${legal.privacyEmail}`} className={linkClass}>
            {legal.privacyEmail}
          </a>
          . Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </Block>

      {legal.extraPrivacyNotes?.map((note) => (
        <p key={note}>{note}</p>
      ))}
    </LegalPage>
  );
}
