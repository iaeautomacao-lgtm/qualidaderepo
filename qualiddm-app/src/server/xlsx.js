const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

/* Funcao e nao constante: o nome da aba chega por parametro na hora de gerar,
   entao nao da para congelar este XML no carregamento do modulo. */
function workbookXml(aba) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${nomeAba(aba)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFC74300"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9D5CE"/></left><right style="thin"><color rgb="FFD9D5CE"/></right><top style="thin"><color rgb="FFD9D5CE"/></top><bottom style="thin"><color rgb="FFD9D5CE"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function escapeXml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colunaExcel(indice) {
  let n = indice + 1;
  let nome = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    nome = String.fromCharCode(65 + resto) + nome;
    n = Math.floor((n - resto) / 26);
  }
  return nome;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(data = new Date()) {
  const ano = Math.max(1980, data.getFullYear());
  const dosTime = (data.getHours() << 11) | (data.getMinutes() << 5) | Math.floor(data.getSeconds() / 2);
  const dosDate = ((ano - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate();
  return { dosTime, dosDate };
}

function u16(valor) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(valor);
  return buffer;
}

function u32(valor) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(valor >>> 0);
  return buffer;
}

function arquivoZip(nome, conteudo, offset) {
  const name = Buffer.from(nome);
  const data = Buffer.from(conteudo);
  const crc = crc32(data);
  const { dosTime, dosDate } = dosDateTime();

  const local = Buffer.concat([
    u32(0x04034b50),
    u16(20),
    u16(0),
    u16(0),
    u16(dosTime),
    u16(dosDate),
    u32(crc),
    u32(data.length),
    u32(data.length),
    u16(name.length),
    u16(0),
    name,
    data,
  ]);

  const central = Buffer.concat([
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0),
    u16(0),
    u16(dosTime),
    u16(dosDate),
    u32(crc),
    u32(data.length),
    u32(data.length),
    u16(name.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(offset),
    name,
  ]);

  return { local, central };
}

function montarZip(arquivos) {
  let offset = 0;
  const locais = [];
  const centrais = [];

  for (const [nome, conteudo] of arquivos) {
    const arquivo = arquivoZip(nome, conteudo, offset);
    locais.push(arquivo.local);
    centrais.push(arquivo.central);
    offset += arquivo.local.length;
  }

  const central = Buffer.concat(centrais);
  const fim = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(arquivos.length),
    u16(arquivos.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...locais, central, fim]);
}

function sheetXml({ colunas, linhas }) {
  const totalColunas = colunas.length;
  const totalLinhas = Math.max(1, linhas.length + 1);
  const ref = `A1:${colunaExcel(totalColunas - 1)}${totalLinhas}`;
  const widths = colunas
    .map((coluna, indice) => {
      const base = Math.max(10, Math.min(42, Number(coluna.largura || String(coluna.titulo).length + 4)));
      return `<col min="${indice + 1}" max="${indice + 1}" width="${base}" customWidth="1"/>`;
    })
    .join("");

  const header = `<row r="1">${colunas
    .map(
      (coluna, indice) =>
        `<c r="${colunaExcel(indice)}1" t="inlineStr" s="1"><is><t>${escapeXml(coluna.titulo)}</t></is></c>`,
    )
    .join("")}</row>`;

  const body = linhas
    .map((linha, rowIndex) => {
      const numeroLinha = rowIndex + 2;
      const cells = colunas
        .map((coluna, indice) => {
          const valor = linha[coluna.chave];
          const refCelula = `${colunaExcel(indice)}${numeroLinha}`;
          if (valor == null || valor === "") return `<c r="${refCelula}" s="0"/>`;
          if (coluna.tipo === "numero" && Number.isFinite(Number(valor))) {
            return `<c r="${refCelula}" s="2"><v>${Number(valor)}</v></c>`;
          }
          return `<c r="${refCelula}" t="inlineStr" s="0"><is><t>${escapeXml(valor)}</t></is></c>`;
        })
        .join("");
      return `<row r="${numeroLinha}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${ref}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${widths}</cols>
  <sheetData>${header}${body}</sheetData>
  <autoFilter ref="${ref}"/>
</worksheet>`;
}

/* Nome de aba tem regras proprias do Excel: no maximo 31 caracteres e nada de
   : \ / ? * [ ]. Passar direto um titulo com barra gera arquivo que o Excel
   recusa abrir, com mensagem generica de "conteudo ilegivel" -- por isso
   sanitiza aqui em vez de confiar em quem chama. */
function nomeAba(valor) {
  const limpo = String(valor || "Planilha").replace(/[:\\/?*[\]]/g, "-").trim();
  return escapeXml(limpo.slice(0, 31) || "Planilha");
}

export function criarXlsx({ colunas, linhas, aba = "Base de Monitoria" }) {
  const agora = new Date().toISOString();
  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>QualiDDM</Application>
</Properties>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>QualiDDM</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${agora}</dcterms:modified>
</cp:coreProperties>`;

  return montarZip([
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", RELS],
    ["docProps/app.xml", app],
    ["docProps/core.xml", core],
    ["xl/workbook.xml", workbookXml(aba)],
    ["xl/_rels/workbook.xml.rels", WORKBOOK_RELS],
    ["xl/styles.xml", STYLES],
    ["xl/worksheets/sheet1.xml", sheetXml({ colunas, linhas })],
  ]);
}
