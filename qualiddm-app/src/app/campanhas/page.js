"use client";

import { useEffect, useState } from "react";
import CatalogoGestao from "@/components/CatalogoGestao";

/**
 * Campanhas de todas as operações, com desempenho por campanha.
 *
 * As opções de operação do formulário vêm de `/api/relatorios/opcoes`, a mesma
 * rota que o dashboard e o copiloto usam — cadastrar campanha exige escolher a
 * operação, e uma segunda lista de nomes acabaria divergindo da primeira.
 */

function texto(valor) {
  return valor == null ? "—" : String(valor).replace(".", ",");
}

export default function CampanhasPage() {
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    let ativo = true;
    fetch("/api/relatorios/opcoes", { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (payload?.ok && ativo) setClientes(payload.data?.clientes ?? []);
      })
      .catch(() => {
        // Sem a lista o formulário fica sem operações para escolher; a listagem
        // de campanhas continua funcionando.
      });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <CatalogoGestao
      ativo="Campanhas"
      breadcrumb="Cadastro > Campanhas"
      titulo="Campanhas"
      descricao="Campanhas por operação e canal, com desempenho dos últimos 31 dias."
      endpoint="/api/campanhas"
      buscaPlaceholder="Buscar campanha ou operação..."
      kpis={(dados) => [
        { rotulo: "Total de campanhas", valor: String(dados?.kpis?.total ?? 0) },
        { rotulo: "Ativas", valor: String(dados?.kpis?.ativas ?? 0) },
        { rotulo: "Monitorias no período", valor: String(dados?.kpis?.monitorias ?? 0) },
        { rotulo: "Nota de qualidade", valor: texto(dados?.kpis?.score), tom: "accent" },
        {
          rotulo: "Sem monitoria",
          valor: String(dados?.kpis?.semMonitoria ?? 0),
          nota: "campanhas sem avaliação no período",
        },
      ]}
      camposDoItem={(item) => [
        { rotulo: "Canal", valor: item.canalRotulo },
        { rotulo: "Monitorias", valor: String(item.monitorias) },
        {
          rotulo: "Nota",
          valor: texto(item.score),
          tom: item.score != null && item.score < 70 ? "danger" : undefined,
        },
        { rotulo: "Formulários", valor: String(item.formularios) },
      ]}
      criar={{
        rotulo: "Nova campanha",
        titulo: "Cadastrar campanha",
        descricao: "O canal define onde a campanha entra nos painéis: Chat ou Telefone ativo.",
        endpoint: "/api/campanhas",
        mensagem: "Campanha cadastrada.",
        campos: [
          {
            nome: "clienteId",
            rotulo: "Operação",
            obrigatorio: true,
            opcoes: clientes.map((cliente) => ({ value: cliente.id, label: cliente.nome })),
          },
          {
            nome: "nome",
            rotulo: "Nome da campanha",
            obrigatorio: true,
            minimo: 2,
            maximo: 160,
            exemplo: "Ex.: Telefone ativo",
          },
          {
            nome: "canal",
            rotulo: "Canal",
            obrigatorio: true,
            padrao: "telefone",
            opcoes: [
              { value: "telefone", label: "Telefone ativo" },
              { value: "chat", label: "Chat" },
            ],
          },
        ],
      }}
      excluir={{ endpoint: (item) => `/api/campanhas/${item.id}` }}
      vazio={{
        titulo: "Nenhuma campanha cadastrada",
        texto: "Cadastre a primeira campanha de uma operação.",
      }}
    />
  );
}
