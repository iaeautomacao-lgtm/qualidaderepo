import ModuloEmConstrucao from "@/components/ModuloEmConstrucao";

/**
 * Segundo item do submenu de Contestações.
 *
 * Existe porque o menu do QualiTalk de referência tem os dois itens, e um link
 * de menu que devolve 404 é pior do que uma tela que diz o que vai ser. Não há
 * print nem contrato de API para esta tela — inventar KPI e tabela aqui seria
 * inventar número, então ela só encaminha para a Gestão ADM, que está pronta.
 */
export default function AvaliacoesCandidatasPage() {
  return (
    <ModuloEmConstrucao
      active="Contestações"
      breadcrumb="Contestações > Avaliações Candidatas"
      titulo="Avaliações Candidatas"
      proposito="Avaliações dentro do prazo de contestação, que o operador ainda pode questionar."
      icone="clock"
      disponivel="será aqui que você acompanha quais avaliações estão no prazo de contestação e quanto tempo resta em cada uma."
      atalho={{
        href: "/contestacoes/gestao-adm",
        rotulo: "Ir para Gestão ADM",
        icone: "shield",
        motivo:
          "A Gestão ADM já lista as avaliações que receberam contestação e permite analisá-las.",
      }}
    />
  );
}
