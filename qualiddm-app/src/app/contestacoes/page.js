import ModuloEmConstrucao from "@/components/ModuloEmConstrucao";

export default function ContestacoesPage() {
  return (
    <ModuloEmConstrucao
      active="Contestações"
      breadcrumb="Qualidade > Contestações"
      titulo="Contestações"
      proposito="Pedidos de revisão abertos pelos operadores sobre critérios avaliados."
      icone="alert"
      disponivel="será aqui que você recebe a contestação, analisa o critério questionado e responde mantendo ou ajustando a nota."
      atalho={{
        href: "/relatorios",
        rotulo: "Ver relatórios",
        icone: "metrics",
        motivo:
          "O relatório “Contestações” lista as contestações abertas e resolvidas por período.",
      }}
    />
  );
}
