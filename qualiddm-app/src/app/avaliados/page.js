"use client";

import CatalogoGestao from "@/components/CatalogoGestao";

/**
 * Avaliados — as pessoas que recebem monitoria.
 *
 * "Excluir" aqui DESATIVA, sempre. A pessoa é autora e alvo de avaliação,
 * feedback e contestação: apagar a linha apagaria a autoria do histórico de
 * qualidade dela. A tela diz isso na mensagem de confirmação em vez de fingir
 * que excluiu.
 */

function texto(valor) {
  return valor == null ? "—" : String(valor).replace(".", ",");
}

const PAPEL = { operador: "Operador", monitor: "Monitor", supervisor: "Supervisor" };

export default function AvaliadosPage() {
  return (
    <CatalogoGestao
      ativo="Avaliados"
      breadcrumb="Cadastro > Avaliados"
      titulo="Avaliados"
      descricao="Operadores monitorados, com desempenho por canal nos últimos 31 dias."
      endpoint="/api/avaliados"
      buscaPlaceholder="Buscar por nome ou e-mail..."
      kpis={(dados) => [
        { rotulo: "Total de pessoas", valor: String(dados?.kpis?.total ?? 0) },
        { rotulo: "Ativas", valor: String(dados?.kpis?.ativos ?? 0) },
        { rotulo: "Avaliadas no período", valor: String(dados?.kpis?.avaliadosNoPeriodo ?? 0) },
        { rotulo: "Nota de qualidade", valor: texto(dados?.kpis?.score), tom: "accent" },
        {
          rotulo: "Sem monitoria",
          valor: String(dados?.kpis?.semMonitoria ?? 0),
          nota: "pessoas ativas sem avaliação no período",
          tom: (dados?.kpis?.semMonitoria ?? 0) > 0 ? "danger" : undefined,
        },
      ]}
      camposDoItem={(item) => [
        { rotulo: "Papel", valor: PAPEL[item.papel] || item.papel },
        { rotulo: "Monitorias", valor: String(item.monitorias) },
        {
          rotulo: "Nota",
          valor: texto(item.score),
          tom: item.score != null && item.score < 70 ? "danger" : undefined,
        },
        {
          rotulo: "Falhas",
          valor: String(item.naoConformes),
          tom: item.naoConformes > 0 ? "warning" : undefined,
        },
      ]}
      criar={{
        rotulo: "Novo operador",
        titulo: "Cadastrar pessoa avaliada",
        descricao: "A senha provisória serve para o primeiro acesso e não é exibida depois.",
        endpoint: "/api/avaliados",
        mensagem: "Pessoa cadastrada.",
        campos: [
          { nome: "nome", rotulo: "Nome completo", obrigatorio: true, minimo: 2, maximo: 140 },
          { nome: "email", rotulo: "E-mail", tipo: "email", obrigatorio: true, maximo: 180 },
          {
            nome: "papel",
            rotulo: "Papel",
            obrigatorio: true,
            padrao: "operador",
            opcoes: [
              { value: "operador", label: "Operador" },
              { value: "monitor", label: "Monitor" },
              { value: "supervisor", label: "Supervisor" },
            ],
          },
          {
            nome: "senhaProvisoria",
            rotulo: "Senha provisória",
            tipo: "password",
            obrigatorio: true,
            minimo: 8,
            maximo: 100,
            ajuda: "Mínimo de 8 caracteres. Combine com a pessoa e peça a troca no primeiro acesso.",
          },
        ],
      }}
      excluir={{ endpoint: (item) => `/api/avaliados/${item.id}` }}
      vazio={{
        titulo: "Nenhuma pessoa cadastrada",
        texto: "Cadastre os operadores que vão receber monitoria.",
      }}
    />
  );
}
