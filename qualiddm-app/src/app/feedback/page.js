import ModuloEmConstrucao from "@/components/ModuloEmConstrucao";

export default function FeedbackPage() {
  return (
    <ModuloEmConstrucao
      active="Feedback"
      breadcrumb="Qualidade > Feedback"
      titulo="Feedback"
      proposito="Devolutivas das avaliações para os operadores, com registro de aplicação e de leitura."
      icone="feedback"
      disponivel="será aqui que você aplica o feedback de cada avaliação, registra o aceite do operador e acompanha o que está pendente."
      atalho={{
        href: "/relatorios",
        rotulo: "Ver relatórios",
        icone: "metrics",
        motivo:
          "O relatório “Pesquisa de Satisfação” reúne as respostas dos operadores sobre os feedbacks.",
      }}
    />
  );
}
