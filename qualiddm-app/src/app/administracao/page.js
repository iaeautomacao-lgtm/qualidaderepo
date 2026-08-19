import { redirect } from "next/navigation";

/**
 * "Administração" virou "Gestão".
 *
 * Redireciona em vez de sumir: o caminho antigo está em link salvo e no
 * histórico de navegador de quem usa o sistema todo dia.
 */
export default function AdministracaoPage() {
  redirect("/gestao");
}
