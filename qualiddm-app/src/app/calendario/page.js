import ModuloEmConstrucao from "@/components/ModuloEmConstrucao";

export default function CalendarioPage() {
  return (
    <ModuloEmConstrucao
      active="Calendário"
      breadcrumb="Qualidade > Calendário"
      titulo="Calendário"
      proposito="Agenda de monitorias, feedbacks e sessões de calibração da operação."
      icone="calendar"
      disponivel="será aqui que você enxerga o mês inteiro e agenda monitorias, feedbacks e calibrações sem conflito de horário."
      atalho={{
        href: "/",
        rotulo: "Voltar ao Dashboard",
        icone: "dashboard",
        motivo: "O Dashboard mostra o que está pendente hoje, mesmo sem a agenda pronta.",
      }}
    />
  );
}
