/**
 * Textos padrão da interface (títulos, botões, rótulos).
 * Para mudar um texto em um cliente, NÃO edite aqui: use `texts` no site.config.ts,
 * informando só o que muda. Ex.: texts: { services: { title: "Cortes e barba" } }.
 *
 * Marcadores aceitos: {cidade}, {bairro}, {nome}. Ver `fillText` em src/lib/texts.ts.
 *
 * Regra de redação: descreva o que existe; não prometa resultado, tempo de espera,
 * exclusividade ou qualidade que o cliente não tenha confirmado.
 */
export const defaultTexts = {
  nav: {
    services: "Serviços",
    pricing: "Preços",
    team: "Equipe",
    gallery: "Galeria",
    faq: "Dúvidas",
    contact: "Contato",
    booking: "Agendar horário",
    menuOpen: "Abrir menu",
    menuClose: "Fechar menu",
    skipToContent: "Pular para o conteúdo",
  },
  hero: {
    primaryCta: "Agendar horário",
    secondaryCta: "Ver preços",
    hoursLabel: "Funcionamento",
    addressLabel: "Endereço",
  },
  services: {
    title: "Serviços",
    intro: "Os atendimentos mais procurados. A tabela completa está logo abaixo.",
    detailsLink: "Ver detalhes",
  },
  pricing: {
    title: "Tabela de preços",
    fromLabel: "a partir de",
  },
  team: {
    title: "Equipe",
    intro: "Quem faz o atendimento.",
  },
  gallery: {
    title: "Galeria",
    intro: "O espaço e alguns trabalhos.",
    enlarge: "Ampliar foto",
    close: "Fechar",
    previous: "Foto anterior",
    next: "Próxima foto",
    dialogLabel: "Foto ampliada",
  },
  booking: {
    title: "Solicite seu horário",
    intro: "Escolha o serviço e o melhor período. A confirmação do horário é feita pela barbearia no WhatsApp.",
    steps: [
      "Preencha o serviço, o profissional e o melhor período.",
      "Toque em enviar: o WhatsApp abre com a mensagem pronta.",
      "A barbearia responde na conversa para confirmar o horário.",
    ],
    requiredHint: "Campos com * são obrigatórios. Nada é salvo neste site: a mensagem vai direto para o WhatsApp.",
    nameLabel: "Seu nome",
    nameError: "Escreva seu nome para a barbearia saber quem vai chegar.",
    serviceLabel: "Serviço",
    servicePlaceholder: "Escolha um serviço",
    serviceError: "Escolha um serviço.",
    professionalLabel: "Profissional",
    noPreference: "Sem preferência",
    dateLabel: "Data preferida",
    periodLabel: "Período",
    notesLabel: "Observações",
    notesPlaceholder: "Ex.: quero manter o comprimento em cima",
    submit: "Enviar pelo WhatsApp",
    sent: "Mensagem pronta. Se o WhatsApp não abriu,",
    sentLink: "abra o WhatsApp por aqui",
  },
  onlineBooking: {
    title: "Agende online",
    text: "Veja os horários livres de verdade e escolha o seu. A barbearia confirma pelo WhatsApp.",
    steps: [
      "Escolha o serviço, o profissional e o horário.",
      "Entre ou crie sua conta com nome, telefone, e-mail e senha.",
      "Envie a mensagem pronta no WhatsApp e aguarde a confirmação.",
    ],
    button: "Ver horários disponíveis",
  },
  whatsappCta: {
    title: "Agende pelo WhatsApp",
    text: "Mande uma mensagem com o serviço e o melhor horário. A barbearia responde para confirmar.",
    button: "Chamar no WhatsApp",
  },
  faq: {
    title: "Dúvidas frequentes",
  },
  contact: {
    title: "Contato e localização",
    intro: "{bairro}, {cidade}.",
    addressTitle: "Endereço",
    directions: "Como chegar",
    hoursTitle: "Horário de funcionamento",
    hoursCaption: "Horários de atendimento por dia da semana",
    closed: "Fechado",
    talkTitle: "Fale com a gente",
    whatsappButton: "Chamar no WhatsApp",
    mapNotice: "O mapa é carregado do Google Maps somente se você quiser.",
    mapButton: "Mostrar mapa",
    mapTitle: "Mapa com a localização da {nome}",
  },
  footer: {
    navTitle: "Navegação",
    addressTitle: "Endereço",
    serviceAreaPrefix: "Atendemos",
    privacy: "Privacidade",
  },
  servicePage: {
    breadcrumbHome: "Início",
    breadcrumbServices: "Serviços",
    duration: "Duração estimada",
    price: "Valor",
    includesTitle: "O que está incluído",
    ctaTitle: "Quer agendar este serviço?",
    ctaButton: "Agendar pelo WhatsApp",
    backToServices: "Ver todos os serviços",
  },
  whatsappFab: "Conversar no WhatsApp",
  newTab: "abre em nova aba",
  notFound: {
    title: "Página não encontrada",
    text: "O endereço pode ter mudado. Volte para o início para ver serviços, preços e contato.",
    back: "Voltar para o início",
  },
};

export type SiteTexts = typeof defaultTexts;
