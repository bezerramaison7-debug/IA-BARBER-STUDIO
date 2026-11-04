import type { Metadata } from "next";
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
 * sem armazenamento no navegador e sem análise. Com o sistema (plano profissional + Supabase): o
 * visitante consulta horários e envia o pedido pelo WhatsApp, sem conta; a barbearia cadastra os
 * clientes que atende no painel. Recurso novo que trate dados = rever esta página.
 */
export default function PrivacyPage() {
  const { business, legal } = siteConfig;
  const features = getFeatures(siteConfig);
  const system = isBookingSystemEnabled(siteConfig);
  const hosting = legal.hostingProvider ?? "Vercel";

  return (
    <LegalPage title="Privacidade" updated={formatIsoDate(legal.privacyUpdatedAt)} demo={siteConfig.demo}>
      <Block title="Quem é o responsável">
        <p>
          Este site é da {business.name}. O responsável pelo tratamento de dados pessoais (controlador) é{" "}
          {legal.controllerName}
          {legal.document ? `, ${legal.document}` : ""}.
        </p>
      </Block>

      {system ? (
        <>
          <Block title="Você não precisa criar conta">
            <p>
              Para pedir um horário, você escolhe serviço, profissional, data e horário livre e informa nome e
              telefone. Não há cadastro, senha nem login para clientes.
            </p>
          </Block>

          <Block title="O que fica no seu navegador">
            <p>
              Nome, telefone e observação que você digita na tela de pedido ficam só na memória da página, no seu
              aparelho. Eles <strong>não são gravados</strong> por este site nem enviados ao nosso banco de dados,
              e não aparecem no endereço da página. Se você fechar a página, eles se perdem.
            </p>
            <p>
              Para mostrar os horários livres, a página consulta o nosso banco de dados (Supabase). Essa consulta
              leva só o serviço, o profissional e a data escolhidos, nunca seus dados.
            </p>
          </Block>

          <Block title="O que vai para o WhatsApp">
            <p>
              Ao tocar em “Abrir o WhatsApp com a mensagem”, o texto (serviço, profissional, data, horário, nome,
              telefone e observação) vai no próprio link para o WhatsApp, um serviço da Meta, que trata esses dados
              conforme a política dele. Você revisa a mensagem e decide se envia. Ao enviar, a mensagem chega ao
              WhatsApp da {business.name}. O pedido <strong>não é uma reserva</strong>: o horário só fica garantido
              quando a barbearia confirma.
            </p>
          </Block>

          <Block title="O que a barbearia grava">
            <p>
              Quando a barbearia confirma um horário com você ou atende você, ela pode cadastrar no painel:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>nome e telefone, e observações sobre o atendimento (por exemplo, preferência de corte);</li>
              <li>agendamentos e atendimentos (serviço, profissional, data, horário e situação);</li>
              <li>o cartão do programa de fidelidade: atendimentos que contam, cortesias e correções.</li>
            </ul>
            <p>
              Uso: organizar a agenda, falar com você sobre o horário e manter o programa de fidelidade (execução
              do serviço que você pediu, LGPD art. 7º, V). Não pedimos CPF, endereço, e-mail, data de nascimento
              nem foto. Não vendemos dados nem usamos para publicidade.
            </p>
            <p>
              Só a equipe autorizada acessa esses dados, por login no painel. Não existe consulta pública por
              telefone, e cada abertura de ficha fica registrada. Telefones podem ser compartilhados (família) ou
              mudar de dono: a barbearia não junta históricos de pessoas diferentes automaticamente.
            </p>
          </Block>

          <Block title="Dados técnicos dos provedores">
            <p>
              A hospedagem ({hosting}) e o banco de dados (Supabase) registram dados técnicos de acesso, como
              endereço IP, navegador, data e página ou consulta feita, para manter o serviço funcionando e seguro.
              Esses serviços processam dados em nome da barbearia (operadores) e podem manter servidores fora do
              Brasil, com as garantias previstas no art. 33 da LGPD.
            </p>
          </Block>

          <Block title="Registros, prazos e cópias de segurança">
            <ul className="list-disc space-y-2 pl-6">
              <li>Cadastro e histórico: enquanto você for cliente ou até pedir a exclusão.</li>
              <li>
                Registro de atividades do painel (quem fez o quê e quando, com o identificador interno e o motivo
                informado): guardado para segurança e prestação de contas, por interesse legítimo (art. 7º, IX).
              </li>
              <li>
                Se você pedir a exclusão, a barbearia apaga nome, telefone, observações, pontos e cortesias e cancela
                horários futuros. Ficam, <strong>sem identificação direta</strong>, os registros de agendamento
                (serviço, profissional, data) e de atividades, além do que a lei obrigar a guardar.
              </li>
              <li>
                Logs técnicos dos provedores seguem os prazos deles. Cópias de segurança feitas pela barbearia contêm o
                cadastro da época e são substituídas no prazo combinado. Até lá, os dados excluídos ainda podem existir
                nessas cópias.
              </li>
            </ul>
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

      {!system && (
        <Block title="WhatsApp">
          <p>
            {features.bookingForm
              ? "O formulário de agendamento não envia nada para este site. O que você escreve fica no seu navegador até você tocar em enviar; nesse momento o WhatsApp abre com a mensagem pronta, e você decide se envia."
              : "Os botões de WhatsApp abrem o aplicativo com uma mensagem pronta, e você decide se envia."}{" "}
            O WhatsApp é um serviço da Meta, com política de privacidade própria. As mensagens recebidas são
            usadas pela {business.name} apenas para responder e agendar o atendimento que você pediu (LGPD,
            art. 7º, V).
          </p>
        </Block>
      )}

      <Block title="Mapa">
        <p>
          O mapa da página de contato vem do Google Maps e só é carregado quando você toca em “Mostrar mapa”.
          Antes disso, o site não se conecta ao Google. Depois, valem as regras de privacidade do Google.
        </p>
      </Block>

      {!system && (
        <Block title="Hospedagem e links externos">
          <p>
            O site é hospedado pela {hosting}, que registra dados técnicos de acesso (como endereço IP,
            navegador e página visitada) para manter o serviço funcionando e seguro. Links para redes sociais
            levam a sites de terceiros, com políticas próprias.
          </p>
        </Block>
      )}

      <Block title="Seus direitos">
        <p>
          Pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018, art. 18), você pode pedir a confirmação
          de que tratamos seus dados, acesso e cópia, correção, eliminação, informações sobre com quem eles são
          compartilhados e opor-se a um uso.
        </p>
        {system && (
          <p>
            Como não há conta de cliente, o pedido é feito diretamente à barbearia, pelo WhatsApp, no balcão ou pelo
            e-mail abaixo. A barbearia registra o pedido, pode confirmar que é você antes de entregar dados e responde
            em até 15 dias.
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
