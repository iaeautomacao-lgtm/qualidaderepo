import PainelGestao from "./page-base";

/**
 * Gestão — aba Operação.
 *
 * A tela é uma só, com duas abas (Operação e Usuários); esta rota abre na
 * primeira. A rota irmã `/gestao/usuarios` abre na segunda, para o item do menu
 * levar direto ao bloco certo em vez de exigir um clique extra na aba.
 */
export default function GestaoPage() {
  return <PainelGestao abaInicial="operacao" />;
}
