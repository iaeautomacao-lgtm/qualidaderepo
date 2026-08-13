import "./globals.css";

export const metadata = {
  title: "QualiDDM - Monitoria e Qualidade",
  description: "Plataforma de qualidade e feedback com IA para call centers.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Não trave o zoom: WCAG 2.2 1.4.4 exige ampliação até 200%.
  themeColor: "#ff5106",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
