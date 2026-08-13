/**
 * Dados de referência copiados dos prints do QualiTalk (pasta PRINTS/).
 *
 * Fonte única das telas enquanto o MySQL não está ligado. Quando o banco
 * entrar, cada bloco daqui vira uma query — os nomes de campo já seguem o
 * schema de `database/migrations/001_initial_schema.sql`.
 *
 * Grafias preservadas como no sistema original, inclusive as inconsistentes
 * (caixa alta/baixa dos operadores). Só os erros que confundem o usuário foram
 * corrigidos, e estão marcados com [corrigido].
 */

/* ==========================================================================
   Dashboard
   ========================================================================== */

/**
 * KPIs do dashboard.
 *
 * Os RÓTULOS vêm dos prints; os VALORES não entram. Os números que apareciam
 * lá (1.326 avaliações, score 57,65, 15:28 de média) são reais, mas da
 * operação medida pelo QualiTalk — não desta base. Exibi-los aqui faria a tela
 * afirmar sobre a operação da DDM um número que ninguém mediu.
 *
 * `value: null` faz a tela mostrar travessão até o banco responder.
 */
export const dashboardKpis = [
  { id: "total-avaliacoes", badge: null, value: null, label: "Total de Avaliações", icon: "review" },
  { id: "score-medio", badge: null, value: null, label: "Score Médio de Qualidade", icon: "gauge" },
  { id: "tempo-medio", badge: null, value: null, label: "Tempo Médio (min:seg)", icon: "clock" },
  { id: "clientes-ativos", badge: null, value: null, label: "Clientes Ativos", icon: "wallet" },
];

/**
 * Eixo duplo: avaliações (volume) contra qualidade (score).
 *
 * Rótulos e escalas dos eixos vieram do print. Os VALORES da série, não: o
 * print mostrava o desenho da linha, não os números. Ficam vazios até o banco
 * responder — série inventada num gráfico vira leitura de tendência que nunca
 * aconteceu.
 */
export const evolucao = {
  labels: ["Mês -5", "Mês -4", "Mês -3", "Mês -2", "Mês -1", "Atual"],
  series: [
    { key: "avaliacoes", label: "Avaliações", axis: "left", values: [] },
    { key: "qualidade", label: "Qualidade", axis: "right", values: [] },
  ],
  leftTicks: [0, 35, 70, 105, 140],
  rightTicks: [0, 15, 30, 45, 60],
};

/**
 * Quadrantes 1Q a 5Q: os rótulos e as cores são do print, a distribuição não —
 * a rosca aparecia sem números legíveis. Vazio até o banco entrar.
 */
export const quadrantes = [];

// Mesma regra dos KPIs: os quatro indicadores existem, as contagens não.
export const statusAtual = [
  { label: "Feedbacks Abertos", detail: null, tone: "warning", icon: "feedback" },
  { label: "Feedbacks Aplicados", detail: null, tone: "success", icon: "checkCircle" },
  { label: "Contestações", detail: null, tone: "info", icon: "alert" },
  { label: "Avaliações Zeradas", detail: null, tone: "danger", icon: "error" },
];

export const topOfensores = [];

/* ==========================================================================
   Clientes (operações)
   ========================================================================== */

export const clientes = [
  { id: "anima", nome: "Ânima", status: "Ativa", formularios: 1, contrato: null },
  { id: "cobranca-isaac", nome: "Cobrança- Isaac", status: "Ativa", formularios: 2, contrato: null },
  { id: "cruzeiro-do-sul", nome: "Cruzeiro do Sul", status: "Ativa", formularios: 2, contrato: null },
  { id: "educacional", nome: "Educacional", status: "Ativa", formularios: 1, contrato: null },
  { id: "empresarial-cobranca", nome: "Empresarial - Cobrança", status: "Ativa", formularios: 1, contrato: null },
  { id: "fiergs", nome: "FIERGS", status: "Ativa", formularios: 1, contrato: "2026" },
  { id: "firjan", nome: "FIRJAN", status: "Ativa", formularios: 9, contrato: "2026" },
  { id: "grupo-avenida", nome: "Grupo Avenida", status: "Ativa", formularios: 0, contrato: null },
  { id: "receptivo", nome: "Receptivo", status: "Ativa", formularios: 2, contrato: null },
  { id: "teste-1", nome: "teste 1", status: "Ativa", formularios: 1, contrato: null },
  { id: "vero", nome: "Vero", status: "Ativa", formularios: 7, contrato: null },
  { id: "yduqs", nome: "Yduqs", status: "Ativa", formularios: 2, contrato: null },
];

/**
 * Os dois primeiros são CONTAGENS da própria lista `clientes` — dado real
 * desta base, calculado, não copiado. Os dois últimos são métricas da operação
 * do QualiTalk e ficam vazios até o banco responder.
 */
export const clientesKpis = [
  { id: "total", badge: "Total", value: String(clientes.length), label: "Total de Clientes", icon: "wallet" },
  {
    id: "ativos",
    badge: "Ativos",
    value: String(clientes.filter((cliente) => cliente.status === "Ativa").length),
    label: "Clientes Ativos",
    icon: "checkCircle",
  },
  { id: "monitorias", badge: null, value: null, label: "Monitorias Realizadas (total)", icon: "review" },
  { id: "qualidade", badge: null, value: null, label: "Nota de Qualidade (score)", icon: "gauge" },
];

/* ==========================================================================
   Campanhas — as 4 primeiras aparecem em negrito no original (favoritas).
   ========================================================================== */

export const campanhas = [
  { nome: "Ativo - Prospecção", favorita: true },
  { nome: "Ativo 20 a 44", favorita: true },
  { nome: "Ativo 45 a 75", favorita: true },
  { nome: "Ativo 76 a 120", favorita: true },
  { nome: "Campanha teste Raphael" },
  { nome: "Canais Online (E-mail, Chat e WhatsApp)" },
  { nome: "Chat" },
  { nome: "Chat - Empresarial" },
  { nome: "E - Saúde Digital" },
  { nome: "Isaac Ativo - Telefone" },
  { nome: "MONITORIAS IA" },
  { nome: "Monitorias IA - Telefone Ativo" },
  { nome: "Monitorias IA - Telefone Receptivo" },
  { nome: "Odontologia e Massagem relaxante (Offline)" },
  { nome: "Pré Churn - Telefone" },
  { nome: "Telefone" },
  { nome: "Telefone Ativo" },
  { nome: "Telefone Receptivo" },
  { nome: "Telefone ativo" },
  { nome: "Telefone ativo Empresarial" },
  { nome: "Teste receptivo" },
  { nome: "Vero Churn" },
  { nome: "Vero Churn - Telefone" },
  { nome: "Vero Pré churn" },
  { nome: "Vero2 - Bck" },
  { nome: "teste 1 campanha" },
];

/* ==========================================================================
   Pessoas
   ========================================================================== */

export const avaliadores = [
  "Dayara Jovita",
  "Denise Esquivel",
  "Fernanda Alves",
  "Raphael Outstand",
  "Roberta Bruna Pereira Diniz",
];

export const categorias = ["Padrão", "Diagnóstico"];

// Grafia exata do sistema original — caixa e acentuação inconsistentes fazem
// parte do dado. `Christiane Pimentel Diniz34567876567` e o registro sujo do
// print; mantido para a tela de administração ter o que limpar.
export const avaliados = [
  "Acassya Mota da Silva",
  "Adriana do Nascimento Laranjeira",
  "Adriana Monteiro Lima",
  "Agatha Cristina de Souza Oliveira Florindo",
  "ALESSANDRA MENDES PEREIRA",
  "Alessandra Reis de Oliveira",
  "Aline Maria de Azevedo Ferreira",
  "Amanda Inocêncio Pereira dos Santos",
  "Ana Beatriz lemos alves",
  "Ana Beatriz Marçal gama ramos",
  "Ana Beatriz Santos Esperança",
  "Ana Carolina Dutra Moraes",
  "Ana Clara Gomes de Arruda",
  "Ana Claudia da Silva",
  "Ana Paula Boge Camargo",
  "Ana Paula Melo Cardoso Soares",
  "Ayrton Oliveira da Silva",
  "Caique Fonseca da Conceição",
  "Camilly Vitoria Valerio da Silva",
  "Carlos Eduardo de Oliveira Nogueira",
  "Chaiane dos Santos Moreno",
  "Christiane Pimentel Diniz34567876567",
  "CLARA LUIZA DE ARAÚJO JACOB",
  "Daniel Luiz Pina",
  "Danilo Felix de Moura Lourenço",
  "Eduarda de Jesus Soares",
  "Eduarda Santiago Brito",
  "EVELYN PALOMA DE SOUZA ESTEVAM",
  "Felipe Silva Batista",
  "Flavia Encrenazi de Oliveira Cunha",
  "Francine da Silva Rocha",
  "Gabriela Alves Machado",
  "Gabriela Barbosa da Silva",
  "Gabriela Duarte Velozo",
  "Giovanni Baptista Miranda",
  "Grazielle de Cassia Silva",
  "Guilherme Pereira Ramos",
  "Jaqueline Siqueira de Almeida",
  "Jennyfer Domingos Queiroz",
  "Jhordana Rodrigues Alves",
  "João Cosme campos Araújo",
  "João Pedro do Nascimento Silva",
  "Josiane Dias Queiroz",
  "Juliana Tavares",
  "Kaio Sousa Gonçalves",
  "Karla Cristina da Silva Fernandes",
  "Kelvyn Moreira Rocha e Silva",
  "Késsia de Oliveira Angelo",
  "Lackson Adriano Ribeiro da Silva",
  "Laís da Silva Ferreira",
  "Laize Silveira leite",
  "Lanaysa Melissa de Almeida garcia",
  "Lenice Ferreira dos Santos",
  "Leonardo Nunes da Silva",
  "Leticia Cristina de Freitas",
  "Leticia Foster de Souza",
  "Leticia Maciel Araújo",
  "Leticia thaniely Teixeira Izidoro",
  "Lorena Saddock de Sá Lopes",
  "Luana Gama da Silva",
  "Luana Santos de Oliveira",
  "Lucas Araújo Custódio",
  "Maiara Cristina de Souza",
  "Maickon Gomes dos Santos",
  "Maira Lopes Lima",
  "Manuela Vieira da Costa Sol Alves",
  "Marcela Vasconcelos Joaquim Alves",
  "Marcia Lima Peixoto",
  "Marcia Thaina Rodrigues Cardoso",
  "Márcio Moreira Lima",
  "Mariana costa ramos",
  "Mariana Nunes da Motta",
  "Mariane de Oliveira Santos",
  "Michelle aparecida alves da silva",
  "Michely Rodrigues Silva",
  "Monique de Oliveira Britto",
  "Nathalia Dantas dos anjos",
  "Nicoly Justino de Barros",
  "Odhara Cristina Severo de Oliveira Britto",
  "Oliria Emmeline Alves do Nascimento Santos",
  "Pâmella de Almeida Moreira Ferreira",
  "Patricia Roxane Macedo de Lara",
  "Paulo Victor Santos da Silva",
  "Rafaelle brito da costa",
  "Raquel Anacleto Gomes",
  "Renata Barros Ribeiro",
  "Renata Rodrigues dos Santos",
  "Rosana Fernandes Pinheiro",
  "Roseli Honorato dos Santos",
  "Sabrina Santana da Costa Ferreira",
  "SAMARA SOUZA DA SILVA",
  "Sarah Danyelle da Silva",
  "SARAH PEREIRA DA MATA",
  "Simone Victoria de Carvalho",
  "Solaine da Rocha Valadares",
  "Sonia Oliveira de Souza",
  "Tamires Dandara dos santos",
  "Tania Mara Godinho",
  "Tatiane Silva Mendez",
  "Thayana Brito Torres da Silva",
  "Thiago Fernandes da silva soares",
  "Ulisses de Oliveira Silverio",
  "Valéria de Oliveira Alves",
  "Valquiria carvalho de Andrade",
  "Victoria de Souza Jesus",
  "Weslley da Silva Bessa",
];

/* ==========================================================================
   Formulários
   ========================================================================== */

// Contagens do QualiTalk (29 formulários, 635 questões), não desta base.
export const formulariosKpis = [
  { id: "total", value: null, label: "Total de Formulários", detail: "Cadastrados no sistema", icon: "checklist" },
  { id: "ativos", value: null, label: "Formulários Ativos", detail: "Prontos para avaliação", icon: "checkCircle" },
  { id: "desenvolvimento", value: null, label: "Em Desenvolvimento", detail: "Aguardando configuração", icon: "edit" },
  { id: "questoes", value: null, label: "Total de Questões", detail: "Critérios de avaliação", icon: "review" },
];

export const acoesRapidas = [
  {
    id: "cadastro",
    titulo: "Cadastro de Formulários",
    detalhe: "Crie e configure novos Formulários de avaliação",
    icon: "plus",
    href: "/formularios/novo",
  },
  {
    id: "iniciar",
    titulo: "Iniciar avaliação",
    detalhe: "Inicie uma nova avaliação de monitoria",
    icon: "review",
    href: "/avaliacoes/nova",
  },
  {
    id: "visualizar",
    titulo: "Visualizar avaliações",
    detalhe: "Acesse e gerencie avaliações realizadas",
    icon: "search",
    href: "/avaliacoes",
  },
  {
    id: "justificativas",
    titulo: "Visualizar justificativas",
    detalhe: "Veja, edite e exclua justificativas lançadas",
    icon: "feedback",
    href: "/avaliacoes?filtro=justificativas",
  },
  {
    id: "relatorios",
    titulo: "Relatórios",
    detalhe: "Visualize relatórios e análises detalhadas",
    icon: "metrics",
    href: "/relatorios",
  },
];

export const formulariosRecentes = [
  { id: "vero-ia", nome: "TESTE - Analises VERO IA", campanhas: 5 },
];

/* ==========================================================================
   Ficha de avaliação — QA-26-000541
   ========================================================================== */

export const avaliacao = {
  id: "QA-26-000541",
  formulario: "Formulário Educacional | Cruzeiro",
  cliente: "Cruzeiro do Sul",
  campanha: "Telefone Ativo",
  codGravacao: "04201062600",
  score: "88.00",
  duracao: "5:44",
  // O player do print marca 2:21 enquanto o cabeçalho diz 5:44. Divergência do
  // sistema original, mantida.
  duracaoAudio: "2:21",
  categoria: "Padrão",
  statusFeedback: "Feedback Pendente",
  dataAvaliacao: "07/08/2026, 09:46",
  dataContato: "03/08/2026, 09:40",
  prazoFeedback: "N/A",
  prazoContestacao: "N/A",
  avaliado: {
    papel: "Avaliado",
    nome: "Camilly Vitoria Valerio da Silva",
    email: "camilly.v@grupoddm.com.br",
  },
  avaliador: {
    papel: "Avaliador",
    nome: "Fernanda Alves",
    email: "fernandaferreira@grupoddm.com.br",
  },
  supervisor: {
    papel: "Supervisor",
    nome: "Fábio Batista Oliveira",
    email: "fabiobatista@grupoddm.com.br",
  },
  resumo: {
    conformes: 24,
    naoConformes: 1,
    naoAplicaveis: 0,
    total: 25,
  },
};

export const secoes = [
  {
    id: "abertura",
    nome: "ABERTURA",
    descricao:
      "Avaliação da abertura do atendimento, com foco na abordagem inicial, identificação do cliente e clareza na comunicação, garantindo um início cordial, profissional e alinhado aos padrões estabelecidos.",
    criterios: [
      {
        nome: "Prontidão",
        enunciado: "Interagiu em até 5 (cinco) segundos após o início do contato.",
        resposta: "sim",
        peso: 6,
        status: "Conforme",
      },
      {
        nome: "Saudação inicial",
        enunciado:
          "O operador informou sua identificação, apresentando-se como representante da área financeira da Estácio ou equivalente, deixando claro o motivo institucional do contato. (Ex.: José! Bom Dia! Meu nome é Maria falo da Estácio, tudo bem?)",
        resposta: "sim",
        peso: 2,
        status: "Conforme",
      },
      {
        nome: "Personalização",
        enunciado:
          "Chamou o cliente pelo nome ao menos 2 vezes, garantindo uma experiência acolhedora, humanizada e alinhada às suas necessidades.",
        resposta: "sim",
        // Ilegível no print — sem peso confirmado, a tela mostra "—".
        peso: null,
        status: "Conforme",
      },
      {
        nome: "Vícios de Linguagem / Erros de Português",
        enunciado:
          "Avaliação de vícios de linguagem e erros de português, considerando a clareza, correção e fluidez na comunicação. Atenção: a partir de 3 ocorrências de vícios de linguagem, o critério passa a ser considerado não conforme. Comunicou-se sem falar erro grave de português como: plural, concordância, pronúncia...?",
        resposta: "sim",
        peso: 10,
        status: "Conforme",
      },
      {
        nome: "Dicção - Tom de voz",
        enunciado:
          "Considerando clareza na fala, ritmo adequado e entonação, garantindo uma comunicação compreensível, segura e alinhada a um atendimento acolhedor e profissional.",
        resposta: "sim",
        peso: 8,
        status: "Conforme",
      },
      {
        nome: "Empatia",
        enunciado:
          "Considerando a capacidade de compreender a situação do cliente, demonstrar acolhimento e conduzir a interação com respeito e sensibilidade, garantindo uma experiência mais humana e positiva.",
        resposta: "sim",
        peso: 5,
        status: "Conforme",
      },
      {
        nome: "Condução - Escuta ativa",
        enunciado:
          "Avaliação da condução e escuta ativa, considerando a capacidade de ouvir atentamente, compreender a real necessidade do cliente e conduzir o atendimento de forma clara, organizada e assertiva, garantindo uma interação fluida e focada na solução.",
        resposta: "sim",
        peso: 1,
        status: "Conforme",
      },
      {
        nome: "Saudação Final",
        enunciado:
          "Considerando o encerramento cordial, a disponibilidade para novas orientações e a finalização clara do atendimento.",
        resposta: "sim",
        peso: 2,
        status: "Conforme",
      },
    ],
  },
  {
    id: "desenvolvimento",
    nome: "DESENVOLVIMENTO",
    descricao: null,
    criterios: [
      {
        nome: "Comunicação de Ausência / Tempo Excedente em Espera",
        enunciado:
          "Avaliação da comunicação de ausência ou tempo excedente em espera, considerando se o cliente é informado de forma clara e adequada sobre pausas, retornos e possíveis demoras, garantindo transparência e uma experiência mais segura durante o atendimento.",
        resposta: "sim",
        peso: 1,
        status: "Conforme",
      },
      {
        nome: "Domínio e Segurança",
        enunciado:
          "Considerando o conhecimento do atendente sobre os processos, clareza nas informações e confiança na condução do atendimento, garantindo assertividade e credibilidade na comunicação com o aluno.",
        resposta: "sim",
        peso: 1,
        status: "Conforme",
      },
      {
        nome: "Atualização cadastral",
        enunciado:
          "Realização e atualização do cadastro, considerando a coleta e validação correta dos dados do cliente, bem como a atualização adequada das informações em sistema.",
        resposta: null,
        peso: null,
        status: "Conforme",
      },
      {
        nome: "Autoatendimento",
        enunciado:
          "Avaliação do direcionamento ao autoatendimento, considerando se o atendente informou, quando aplicável, sobre os canais disponíveis da IES (Portal do Aluno/Giz, Meu Arco), incentivando a autonomia do aluno e facilitando futuras consultas e solicitações.",
        resposta: "sim",
        peso: 1,
        status: "Conforme",
      },
    ],
  },
  {
    id: "negociacao",
    nome: "NEGOCIAÇÃO/COBRANÇA",
    descricao: null,
    criterios: [
      {
        nome: "Abordagem",
        enunciado:
          "Avaliação da apresentação do motivo do contato, considerando se o atendente seguiu o roteiro ao expor a proposta, informando de forma clara os valores, débitos incluídos na negociação, forma de pagamento a vista, pix, parcelado e a data de pagamento disponível na plataforma, utilizando comunicação estratégica para valorizar a oportunidade de regularização.",
        resposta: "sim",
        peso: 12,
        status: "Conforme",
      },
      {
        nome: "Sondagem",
        enunciado:
          "Avaliação da sondagem, considerando a capacidade do atendente de compreender o cenário do cliente após apresentar o motivo do contato e a proposta, explorando de forma estratégica as necessidades e possibilidades, a fim de direcionar a negociação de maneira mais assertiva.",
        resposta: "sim",
        peso: 12,
        status: "Conforme",
      },
      {
        nome: "Argumentação",
        enunciado:
          "Avaliação da argumentação, considerando a capacidade do atendente de utilizar o discurso do cliente para construir colocações pertinentes, destacando características e benefícios da proposta, com o objetivo de conduzir o atendimento de forma estratégica rumo ao aceite da negociação.",
        resposta: "sim",
        peso: 12,
        status: "Conforme",
      },
      {
        nome: "Contorno de objeção",
        enunciado:
          "Avaliação do contorno de objeção, considerando se, diante das objeções apresentadas pelo aluno, o agente realizou no mínimo três tentativas de contorno ao longo do contato, de forma coerente e alinhada ao contexto da ligação, indo além do cumprimento de protocolo e buscando conduzir a negociação com estratégia.",
        resposta: "sim",
        peso: 12,
        status: "Conforme",
      },
      {
        nome: "Fechamento da negociação",
        enunciado:
          "Avaliação do fechamento da negociação, aplicável tanto para casos de acordo formalizado quanto para recusa, considerando se o atendente orientou de forma clara sobre as condições ou, quando necessário, sobre as consequências do não pagamento, garantindo transparência e um encerramento adequado do atendimento.",
        resposta: "não",
        peso: 12,
        status: "Não Conforme",
        observacao:
          "A operadora realizou o fechamento da negociação, porém deixou de orientar o cliente sobre a aplicação de juros e multa em caso de inadimplência, não atendendo integralmente ao critério de fechamento da negociação.",
      },
    ],
  },
  {
    id: "ncg",
    nome: "NCG",
    descricao: null,
    // Toda a seção é eliminatória: não pontua, reprova.
    criterios: [
      {
        nome: "Informações erradas",
        enunciado:
          "Avaliação de informações erradas, considerando se o atendente deixou de transmitir corretamente as informações conforme descrito nas ferramentas de suporte (roteiro de atendimento, etc.), sendo aplicável apenas quando houver erro por parte do operador na orientação prestada ao cliente.",
        resposta: "sim",
        eliminatoria: true,
        status: "Conforme",
      },
      {
        nome: "Informações incompletas",
        enunciado:
          "Avaliação de informações incompletas, considerando se o atendente deixou de informar ou realizar itens previstos no checklist/roteiro do acompanhamento, como, por exemplo, o cadastro CPC em casos de acordo realizado, sendo registrada quando essa ausência puder gerar prejuízo para as partes envolvidas.",
        resposta: "sim",
        eliminatoria: true,
        status: "Conforme",
      },
      {
        nome: "Acordo indevido",
        enunciado:
          "Avaliar, considerando se o atendente registrou a negociação sem a devida confirmação do devedor, sendo analisado neste item possíveis indícios de má-fé na condução e no registro do atendimento.",
        resposta: "sim",
        eliminatoria: true,
        status: "Conforme",
      },
      {
        nome: "Tabulação (Registro do atendimento)",
        enunciado:
          "Considerar se o atendente registrou corretamente o motivo do contato e as informações do atendimento em sistema, sendo apontado quando houver ausência de registro.",
        resposta: null,
        eliminatoria: true,
        status: "Conforme",
      },
      {
        nome: "Quebra de Sigilo",
        enunciado:
          "Avaliar se houve compartilhamento indevido de informações a terceiros ou falha na confirmação dos dados do titular antes de prosseguir com o atendimento, em desacordo com as diretrizes da LGPD, comprometendo a segurança e confidencialidade das informações.",
        resposta: "sim",
        eliminatoria: true,
        status: "Conforme",
      },
      {
        nome: "Mau atendimento",
        enunciado:
          "Considerando se o atendente adotou postura desrespeitosa, impaciente, grosseira ou ríspida, bem como a realização de comentários impróprios, irônicos ou uso de palavras inadequadas, comprometendo a qualidade e a experiência do cliente.",
        resposta: "sim",
        eliminatoria: true,
        status: "Conforme",
      },
      {
        // [corrigido] O original não fecha o parêntese.
        nome: "Desconexão da chamada (Derrubar a ligação)",
        enunciado:
          "Considerando se o atendente encerrou a ligação sem justificativa, desconectando o cliente de forma indevida. Não deve ser aplicado em casos de falha sistêmica ou quando houver utilização do script adequado para encerramento por falta de comunicação.",
        resposta: "sim",
        eliminatoria: true,
        status: "Conforme",
      },
      {
        nome: "Omissão de atendimento",
        enunciado:
          "Considerando se o atendente iniciou o contato após tempo superior a 20 segundos da entrada da chamada, manteve a ligação sem justificativa após recado da operadora ou caixa postal, ou abandonou o atendimento sem motivo. Também se aplica quando permanece em linha diante de chamada muda, sem a devida tratativa, caracterizando falha na condução do atendimento.",
        resposta: "sim",
        eliminatoria: true,
        status: "Conforme",
      },
    ],
  },
];

/* ==========================================================================
   Relatórios
   ========================================================================== */

export const tiposRelatorio = [
  { id: "base-monitoria", nome: "Base de Monitoria", favorito: true, descricao: "Relatório completo de avaliações com todos os campos" },
  { id: "base-monitoria-ia", nome: "Base de Monitoria IA", favorito: false, descricao: "Monitorias realizadas pelo Monitor IA (avaliações automáticas via IA)" },
  { id: "usuarios", nome: "Usuários", favorito: false, descricao: "Listagem completa de usuários" },
  { id: "fichas-avaliacao", nome: "Fichas de Avaliação", favorito: false, descricao: "Detalhamento de avaliações por critério" },
  { id: "contestacoes", nome: "Contestações", favorito: false, descricao: "Relatório de contestações abertas e resolvidas" },
  { id: "monitoria-analitico", nome: "Monitoria Analítico", favorito: true, descricao: "Consolidado de monitorias por período" },
  { id: "analitico-calibracao", nome: "Analítico de Calibração", favorito: false, descricao: "Dados de sessões de calibração" },
  { id: "pesquisa-satisfacao", nome: "Pesquisa de Satisfação", favorito: false, descricao: "Respostas dos operadores sobre feedbacks" },
  { id: "justificativas", nome: "Justificativas de Avaliação", favorito: false, descricao: "Critérios com justificativas do monitor" },
  { id: "fichas-excluidas", nome: "Fichas Excluídas/Avulsas", favorito: false, descricao: "Auditoria de exclusões com autor, data, motivo e dados da avaliação" },
  { id: "ausencia-monitoria", nome: "Ausência de Monitoria", favorito: true, descricao: "Justificativas de por que operadores não foram avaliados no período" },
  { id: "monitoria-editada", nome: "Monitoria Editada", favorito: false, descricao: "Trilha de auditoria de edições realizadas em avaliações" },
  { id: "extracao-campanhas", nome: "Extração de Campanhas", favorito: false, descricao: "Listagem de todos os clientes e campanhas (ativos e inativos)" },
  { id: "monitoria-detalhada", nome: "Monitoria Detalhada", favorito: true, descricao: "Consolidado detalhado por avaliação e critério" },
];

/* ==========================================================================
   Análises com IA

   Bloco separado dos 14 relatórios de sistema: aqui a saída não é uma tabela,
   é texto interpretado. O `ia: true` é o que faz a tela trocar o chip, o
   painel de resultado e a lista de exportação.
   ========================================================================== */

export const tiposRelatorioIA = [
  {
    id: "ia-resumo-executivo",
    nome: "Resumo Executivo",
    favorito: false,
    ia: true,
    descricao: "Síntese do período em linguagem natural, com o que mudou e por quê",
  },
  {
    id: "ia-analise-ofensores",
    nome: "Análise de Ofensores",
    favorito: false,
    ia: true,
    descricao: "Critérios que mais reprovam, agrupados por causa provável",
  },
  {
    id: "ia-plano-coaching",
    nome: "Plano de Coaching",
    favorito: false,
    ia: true,
    descricao: "Ações recomendadas por operador, priorizadas por impacto",
  },
  {
    id: "ia-risco-ncg",
    nome: "Risco de NCG",
    favorito: false,
    ia: true,
    descricao: "Operadores e campanhas com maior chance de falha eliminatória",
  },
];

export const usuarioAtual = {
  nome: "Gisele Oliveira",
  perfil: "Administrador",
  iniciais: "GO",
};

export const versao = { numero: "v1.5.0", ambiente: "DEV" };
