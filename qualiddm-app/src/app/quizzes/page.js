import ModuloEmConstrucao from "@/components/ModuloEmConstrucao";

export default function QuizzesPage() {
  return (
    <ModuloEmConstrucao
      active="Quizzes"
      breadcrumb="Qualidade > Quizzes"
      titulo="Quizzes"
      proposito="Testes de conhecimento aplicados às equipes a partir dos critérios dos Formulários."
      icone="target"
      disponivel="será aqui que você monta os testes, define o gabarito e acompanha quem respondeu."
      atalho={{
        href: "/formularios",
        rotulo: "Ir para Formulários",
        icone: "checklist",
        motivo: "Os critérios que alimentam um quiz saem dos Formulários de avaliação.",
      }}
    />
  );
}
