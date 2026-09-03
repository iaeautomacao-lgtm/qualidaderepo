import { redirect } from "next/navigation";

/** "Relatórios" virou a aba "Dashboard de Formulários". */
export default function RelatoriosPage() {
  redirect("/dashboard-formularios");
}
