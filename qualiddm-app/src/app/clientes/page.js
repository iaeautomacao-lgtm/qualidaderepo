import { redirect } from "next/navigation";

/**
 * "Clientes" virou "Operações".
 *
 * Redireciona em vez de sumir: o caminho antigo está em link salvo, em histórico
 * de navegador e em conversa de WhatsApp da equipe.
 */
export default function ClientesPage() {
  redirect("/operacoes");
}
