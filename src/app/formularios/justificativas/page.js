import { redirect } from "next/navigation";

/**
 * Justificativas saiu da navegação de Formulários.
 *
 * A rota fica de pé como redirecionamento porque estava no menu até agora — link
 * salvo e histórico de navegador continuam funcionando em vez de dar 404.
 */
export default function JustificativasPage() {
  redirect("/formularios");
}
