import { redirect } from "next/navigation";

/**
 * "Contestações" é um grupo de menu, não uma tela.
 *
 * Quem digita /contestacoes cai direto na Gestão ADM. "Avaliações candidatas"
 * deixou de ser entrada principal do fluxo: a área operacional só deve listar
 * monitorias que foram efetivamente contestadas.
 */
export default function ContestacoesPage() {
  redirect("/contestacoes/gestao-adm");
}
