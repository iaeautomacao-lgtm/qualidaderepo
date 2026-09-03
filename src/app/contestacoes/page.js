import { redirect } from "next/navigation";

/**
 * "Contestações" é um grupo de menu, não uma tela.
 *
 * Quem digita /contestacoes cai na primeira sub-aba — a mesma que o menu abre,
 * como na tela de referência.
 */
export default function ContestacoesPage() {
  redirect("/contestacoes/avaliacoes-candidatas");
}
