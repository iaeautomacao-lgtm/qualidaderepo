const EMAILS_EXCLUSAO_MONITORIA = new Set([
  "admin@qualiddm.local",
  "gisele.oliveira@ddm.com.br",
  "gisele.oliveira@ddm.com",
  "gisele.oliveira@grupoddm.com.br",
  "dayara.jovita@grupoddm.com.br",
]);

const NOMES_EXCLUSAO_MONITORIA = new Set([
  "gisele oliveira",
  "dayara jovita",
]);

const ROLES_COM_ACESSO_A_EXCLUSAO = new Set([
  "administrador",
  "supervisor",
  "monitor",
]);

export function podeExcluirMonitoria(user) {
  if (!user) return false;
  const email = String(user.email || "").trim().toLowerCase();
  const nome = String(user.name || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

  return (
    ROLES_COM_ACESSO_A_EXCLUSAO.has(user.role) &&
    (EMAILS_EXCLUSAO_MONITORIA.has(email) || NOMES_EXCLUSAO_MONITORIA.has(nome))
  );
}
