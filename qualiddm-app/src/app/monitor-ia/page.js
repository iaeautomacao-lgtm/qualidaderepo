import ModuloEmConstrucao from "@/components/ModuloEmConstrucao";

export default function MonitorIaPage() {
  return (
    <ModuloEmConstrucao
      active="Monitor IA"
      breadcrumb="Qualidade > Monitor IA"
      titulo="Monitor IA"
      proposito="Monitorias avaliadas automaticamente por inteligência artificial, sem avaliador humano na primeira passada."
      icone="sparkles"
      disponivel="será aqui que você acompanha as avaliações automáticas, o grau de confiança de cada uma e o que precisa de revisão humana."
      atalho={{
        href: "/relatorios",
        rotulo: "Ver relatórios",
        icone: "metrics",
        motivo: "O relatório “Base de Monitoria IA” já está previsto na tela de Relatórios.",
      }}
    />
  );
}
