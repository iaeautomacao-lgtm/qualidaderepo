"use client";

import CatalogoGestao from "@/components/CatalogoGestao";

/**
 * Operações — a antiga tela de "Clientes".
 *
 * Cada cartão é uma operação (carteira) com o desempenho do período, a quebra
 * entre Chat e Telefone ativo, e o "Acessar", que abre as campanhas daquela
 * operação.
 */

function texto(valor) {
  return valor == null ? "—" : String(valor).replace(".", ",");
}

export default function OperacoesPage() {
  return (
    <CatalogoGestao
      ativo="Operações"
      breadcrumb="Cadastro > Operações"
      titulo="Operações"
      descricao="Carteiras em operação, com desempenho por canal nos últimos 31 dias."
      endpoint="/api/operacoes"
      buscaPlaceholder="Buscar operação..."
      kpis={(dados) => [
        { rotulo: "Total de operações", valor: String(dados?.kpis?.total ?? 0) },
        { rotulo: "Ativas", valor: String(dados?.kpis?.ativos ?? 0) },
        { rotulo: "Monitorias no período", valor: String(dados?.kpis?.monitorias ?? 0) },
        {
          rotulo: "Nota de qualidade",
          valor: texto(dados?.kpis?.score),
          tom: "accent",
          nota: "média ponderada por volume",
        },
        {
          rotulo: "Avaliações críticas",
          valor: String(dados?.kpis?.criticas ?? 0),
          tom: (dados?.kpis?.criticas ?? 0) > 0 ? "danger" : undefined,
        },
      ]}
      camposDoItem={(item) => [
        { rotulo: "Campanhas", valor: String(item.campanhas) },
        { rotulo: "Monitorias", valor: String(item.monitorias) },
        {
          rotulo: "Nota",
          valor: texto(item.score),
          tom: item.score != null && item.score < 70 ? "danger" : undefined,
        },
        {
          rotulo: "Críticas",
          valor: String(item.criticas),
          tom: item.criticas > 0 ? "danger" : undefined,
        },
      ]}
      acessar={{ href: (item) => `/operacoes/${item.id}`, rotulo: "Acessar", icone: "chevronRight" }}
      criar={{
        rotulo: "Novo cliente",
        titulo: "Cadastrar operação",
        descricao: "O nome aparece em toda a plataforma; o contrato é opcional.",
        endpoint: "/api/operacoes",
        mensagem: "Operação cadastrada.",
        campos: [
          {
            nome: "nome",
            rotulo: "Nome da operação",
            obrigatorio: true,
            minimo: 2,
            maximo: 160,
            exemplo: "Ex.: Cobrança - Isaac",
          },
          { nome: "contrato", rotulo: "Contrato", maximo: 40, ajuda: "Identificador do contrato, se houver." },
        ],
      }}
      excluir={{ endpoint: (item) => `/api/operacoes/${item.id}` }}
      vazio={{
        titulo: "Nenhuma operação cadastrada",
        texto: "Cadastre a primeira operação para começar a receber monitorias.",
      }}
    />
  );
}
