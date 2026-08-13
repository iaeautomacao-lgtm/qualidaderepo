import ModuloEmConstrucao from "@/components/ModuloEmConstrucao";

export default function CalibracaoPage() {
  return (
    <ModuloEmConstrucao
      active="Sala de Calibração"
      breadcrumb="Qualidade > Sala de Calibração"
      titulo="Sala de Calibração"
      proposito="Sessões em que vários avaliadores avaliam a mesma chamada para alinhar critério."
      icone="users"
      disponivel="será aqui que você abre a sessão, compara as notas de cada avaliador e registra o consenso do grupo."
      atalho={{
        href: "/relatorios",
        rotulo: "Ver relatórios",
        icone: "metrics",
        motivo: "O relatório “Analítico de Calibração” traz os dados das sessões realizadas.",
      }}
    />
  );
}
