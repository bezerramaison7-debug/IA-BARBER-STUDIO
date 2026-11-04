import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site.config";
import { LegalBlock as Block, LegalPage } from "@/components/ui/legal";
import { isBookingSystemEnabled } from "@/lib/plan";
import { formatIsoDate } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Cookies",
  description: `O que o site da ${siteConfig.business.name} guarda no seu navegador.`,
  alternates: { canonical: "/cookies" },
};

/**
 * Política de cookies fiel ao que o site faz. Hoje não há cookie de análise nem de publicidade,
 * por isso não existe banner de consentimento. Adicionar qualquer um deles exige banner e revisão desta página.
 */
export default function CookiesPage() {
  const accounts = isBookingSystemEnabled(siteConfig);
  return (
    <LegalPage title="Cookies" updated={formatIsoDate(siteConfig.legal.privacyUpdatedAt)} demo={siteConfig.demo}>
      <Block title="Resumo">
        <p>
          Este site não usa cookies de estatística, publicidade ou rastreamento, e não compartilha sua navegação
          com redes de anúncios. Por isso não mostramos aviso pedindo para aceitar cookies.
        </p>
      </Block>

      <Block title="O que fica no seu navegador">
        {accounts ? (
          <>
            <p>
              Só um item, e apenas se você entrar na sua conta: a sessão de login, guardada no armazenamento local
              do navegador (nome começando por <code>sb-</code>). Ela mantém você conectado entre uma página e
              outra e é renovada automaticamente.
            </p>
            <p>
              É estritamente necessária para a conta funcionar, então não depende de consentimento. Ela é apagada
              quando você toca em “Sair”. Você também pode apagá-la limpando os dados do site no navegador.
            </p>
          </>
        ) : (
          <p>Nada. O site não grava cookies nem usa o armazenamento local do navegador.</p>
        )}
      </Block>

      <Block title="Serviços de terceiros">
        <p>
          O mapa do Google só é carregado se você tocar em “Mostrar mapa”. A partir daí o Google pode gravar os
          próprios cookies, conforme a política dele. Os botões de WhatsApp e de redes sociais levam a outros
          sites, com regras próprias.
        </p>
      </Block>

      <Block title="Mais informações">
        <p>
          Veja como tratamos dados pessoais em{" "}
          <Link href="/privacidade" className="text-accent underline underline-offset-4">Privacidade</Link>.
        </p>
      </Block>
    </LegalPage>
  );
}
