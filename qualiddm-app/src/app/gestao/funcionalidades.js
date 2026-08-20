/**
 * Catálogo das funcionalidades de Administração.
 *
 * É estrutura do app, não dado: o que existe no painel depende de quais telas
 * foram construídas, e isso não se resolve com uma tabela no banco. Por isso
 * vive em código — mas num arquivo só, porque duas coisas o consomem:
 *
 * - `administracao/page.js`, que desenha os cartões das duas abas;
 * - `administracao/[secao]/page.js`, que atende o clique de quem ainda não tem
 *   tela própria e explica o que aquela seção vai fazer.
 *
 * Uma fonte só é o que garante que o cartão e a tela de destino nunca digam
 * coisas diferentes sobre a mesma funcionalidade.
 *
 * Campos:
 *   id       — slug da URL em /administracao/{id}
 *   rotulo   — título no cartão
 *   detalhe  — a linha de descrição
 *   proposito/disponivel — texto da tela de destino (ver ModuloEmConstrucao)
 *   novo     — marca o selo "Novo"; hoje é um literal daqui, sem origem no banco
 *   href     — só quando a funcionalidade JÁ tem tela própria; sem isso o
 *              cartão aponta para /administracao/{id}
 *   contador — chave dentro de `operacao` na resposta de
 *              /api/administracao/metricas. Quando existe, o cartão mostra
 *              quantos registros aquela funcionalidade já tem — um cartão de
 *              menu que diz "12 automações" informa mais do que só o nome.
 */

export const OPERACAO = [
  {
    id: "automacoes",
    contador: "automacoes",
    rotulo: "Automações",
    detalhe: "Gerenciar regras, templates, destinos e execuções automáticas",
    proposito: "Regras que disparam ações sozinhas: distribuir monitorias, cobrar feedback, avisar o superior.",
    disponivel: "será aqui que você cria a regra, escolhe o gatilho e acompanha cada execução automática.",
    icone: "bolt",
    tom: "orange",
  },
  {
    id: "faixas-performance",
    contador: "faixaConjuntos",
    rotulo: "Conjuntos de Faixas de Performance",
    detalhe: "Configurar faixas de desempenho e prazos de feedback",
    proposito: "As faixas que traduzem nota em desempenho — e o prazo de feedback que cada faixa exige.",
    disponivel: "será aqui que você define os cortes de cada faixa e quantos dias o feedback tem em cada uma.",
    icone: "layers",
    tom: "purple",
  },
  {
    id: "configuracoes-feedbacks",
    rotulo: "Configurações de Feedbacks",
    detalhe: "Configurar prazos em dias e cores para status de feedbacks",
    proposito: "Prazos e sinalização dos status de feedback usados na Lista de Feedbacks.",
    disponivel: "será aqui que você ajusta o prazo de cada status e como ele aparece na listagem.",
    icone: "feedback",
    tom: "blue",
  },
  {
    id: "metas-monitoria",
    contador: "metas",
    rotulo: "Metas Mensais de Monitoria",
    detalhe: "Definir e acompanhar metas mensais de monitoria",
    proposito: "Quantas monitorias cada campanha ou monitor deve entregar no mês.",
    disponivel: "será aqui que você lança a meta do mês e acompanha o quanto já foi cumprido.",
    icone: "metrics",
    tom: "green",
  },
  {
    id: "categorias-formularios",
    contador: "categorias",
    rotulo: "Categorias de Formulários",
    detalhe: "Gerenciar categorias dinâmicas para classificação de formulários",
    proposito: "As categorias que classificam formulários e alimentam o filtro Categoria dos relatórios.",
    disponivel: "será aqui que você cria e renomeia as categorias sem depender de deploy.",
    icone: "checklist",
    tom: "purple",
    novo: true,
  },
  {
    id: "justificativas",
    contador: "motivosJustificativa",
    rotulo: "Justificativas",
    detalhe: "Gerenciar motivos de justificativa para ausência de monitoria e feedback",
    icone: "feedback",
    tom: "orange",
    novo: true,
    // Já tem tela própria: o cartão vai direto para ela.
    href: "/formularios/justificativas",
  },
  {
    id: "turnos",
    contador: "turnos",
    rotulo: "Turnos",
    detalhe: "Cadastrar e gerenciar turnos de trabalho",
    proposito: "Turnos de trabalho dos operadores, usados para distribuir monitoria e agendar feedback.",
    disponivel: "será aqui que você cadastra os turnos e associa cada operador ao seu.",
    icone: "clock",
    tom: "yellow",
    novo: true,
    href: "/gestao/turnos",
  },
  {
    id: "workflow",
    contador: "workflowsAtivos",
    rotulo: "Ver meu Workflow",
    detalhe: "Visualizar o workflow ativo do tenant em modo de visualização",
    proposito: "O fluxo configurado hoje: da avaliação ao feedback assinado, com quem age em cada etapa.",
    disponivel: "será aqui que você vê o fluxo ativo em modo leitura, sem risco de alterar nada.",
    icone: "workflow",
    tom: "teal",
  },
  {
    id: "bug-reports",
    contador: "bugsAbertos",
    rotulo: "Bug Reports",
    detalhe: "Visualizar bugs reportados pelos usuários do seu tenant",
    proposito: "Problemas relatados pelos próprios usuários do QualiDDM.",
    disponivel: "será aqui que você lê os relatos, acompanha o status e responde quem abriu.",
    icone: "bug",
    tom: "red",
    novo: true,
    href: "/gestao/bugs",
  },
];

export const USUARIOS = [
  {
    id: "usuarios",
    rotulo: "Usuários de DDM",
    detalhe: "Convidar usuários, gerenciar status e redefinir senhas",
    proposito: "Quem tem acesso ao QualiDDM, com que cargo e em que situação.",
    disponivel: "será aqui que você convida usuários, ativa e desativa acessos e redefine senhas.",
    icone: "users",
    tom: "blue",
    href: "/gestao/usuarios",
  },
  {
    id: "sessoes-presenca",
    rotulo: "Sessões e Presença",
    detalhe: "Monitorar status de usuários e gerenciar sessões ativas",
    proposito: "Quem está conectado agora e quais sessões seguem abertas.",
    disponivel: "será aqui que você vê a presença em tempo real e encerra sessões suspeitas.",
    icone: "activity",
    tom: "green",
    novo: true,
  },
  {
    id: "trilha-auditoria",
    rotulo: "Trilha de Auditoria",
    detalhe: "Registro de acessos e ações sensíveis (compliance)",
    proposito: "Registro imutável de quem acessou o quê e quem alterou o quê.",
    disponivel: "será aqui que você consulta a trilha por usuário, período e tipo de ação.",
    icone: "review",
    tom: "neutral",
    novo: true,
  },
];

const POR_ID = new Map([...OPERACAO, ...USUARIOS].map((item) => [item.id, item]));

export function funcionalidadePorId(id) {
  return POR_ID.get(id) ?? null;
}

/** Destino do cartão: a tela própria quando existe, ou o stub explicativo. */
export function destinoDe(item) {
  return item.href ?? `/administracao/${item.id}`;
}
