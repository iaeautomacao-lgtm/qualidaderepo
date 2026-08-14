import { redirect } from "next/navigation";

/**
 * `/contestacoes` não tem tela própria: é o pai do submenu.
 *
 * Antes esta rota era um aviso de "módulo em construção", o que passou a mentir
 * quando a Gestão ADM ficou pronta. Encaminhar para a tela que existe evita o
 * beco sem saída e faz o clique no item pai do menu abrir o painel de trabalho
 * — mesmo comportamento do item Formulários, cujo pai abre o Painel.
 *
 * Se um dia houver um painel consolidado de Contestações, ele substitui este
 * redirecionamento sem mudar nada no menu.
 */
export default function ContestacoesPage() {
  redirect("/contestacoes/gestao-adm");
}
