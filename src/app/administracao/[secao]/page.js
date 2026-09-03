import { redirect } from "next/navigation";

/** Seções antigas de /administracao passam a viver em /gestao. */
export default async function AdministracaoSecaoPage({ params }) {
  const { secao } = await params;
  redirect(`/gestao/${secao}`);
}
