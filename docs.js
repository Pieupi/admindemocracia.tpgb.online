"use strict";
/* Documentos autenticados (área restrita).
   Emite um documento com código único + impressão digital SHA-256, guarda no Supabase
   e gera o PDF no navegador com QR Code que aponta para a página pública "Verificar documento".
   Depende de admin.js (SB, ME, ST, $, esc, mkSel, loadSettings) e das bibliotecas jsPDF e qrcode-generator. */
(function () {
  const TY = { oficio: "Ofício", declaracao: "Declaração", nota: "Nota técnica", relatorio: "Relatório", comunicado: "Comunicado" };
  const SEP = "\u001f", LIME = [198, 242, 78], TZ = { timeZone: "America/Sao_Paulo" };
  let LIST = [];

  /* ---------- datas, hash e texto ---------- */
  const dBR = iso => new Date(iso).toLocaleDateString("pt-BR", { ...TZ, day: "numeric", month: "long", year: "numeric" });
  const tBR = iso => new Date(iso).toLocaleTimeString("pt-BR", { ...TZ, hour: "2-digit", minute: "2-digit" });
  const fdt = iso => dBR(iso) + " às " + tBR(iso) + " (horário de Brasília)";
  const sec = iso => new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z");
  /* Mesma receita da função doc_hash do banco: campos separados por chr(31). */
  const canon = d => ["v1", d.code, d.doc_type, d.title, d.recipient || "", d.body, d.signer_name, d.signer_role || "", sec(d.issued_at)].join(SEP);
  async function sha(s) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  /* As fontes padrão do PDF cobrem Latin-1 (acentos do português). O resto vira equivalente simples. */
  const S = s => String(s == null ? "" : s)
    .replace(/[\u2018\u2019\u201A]/g, "'").replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-").replace(/\u2026/g, "...").replace(/[\u2022\u25CF\u25AA]/g, "-")
    .replace(/\u00A0/g, " ").replace(/\t/g, "  ")
    .replace(/[^\n\x20-\x7E\u00A1-\u00FF]/g, "");

  /* Listas: linhas que começam com "|" formam uma tabela (a primeira é o cabeçalho).
     Linhas "@num" (numerar linhas) e "@banner #RRGGBB" (faixa colorida) são opções de layout. */
  const kind = d => /^\|/m.test(d.body || "") ? "Lista" : (TY[d.doc_type] || "Documento");
  const parseBody = body => {
    const o = { num: false, banner: null }, lines = [];
    for (const raw of String(body).split("\n")) {
      const m = raw.trim().match(/^@(num|banner)\b\s*(#[0-9a-fA-F]{6})?$/);
      if (m) { if (m[1] === "num") o.num = true; else o.banner = m[2] || "#3A4590"; continue; }
      lines.push(raw);
    }
    return { o, lines };
  };
  const cells = t => t.slice(1).split("|").map(c => c.trim());
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

  const base = () => {
    let u = String(ST.site_url || "").trim();
    if (!/^https:\/\//.test(u)) u = location.origin.replace("//admin.", "//");
    return u.replace(/\/+$/, "");
  };
  const vurl = code => base() + "/verificar/?c=" + code;
  const errMsg = e => {
    const c = String((e && e.code) || ""), m = String((e && e.message) || "");
    if (/PGRST20[25]|42P01|42883/.test(c) || /schema cache|does not exist/i.test(m))
      return "O banco ainda não tem as tabelas e funções de documentos. Rode o arquivo documentos.sql no Supabase (SQL Editor).";
    return m || "Não foi possível concluir.";
  };

  /* ---------- PDF ---------- */
  async function makePDF(d) {
    if (!window.jspdf || !window.qrcode) throw new Error("As bibliotecas de PDF não carregaram. Recarregue a página e tente de novo.");
    if ((await sha(canon(d))) !== d.content_hash) throw new Error("A impressão digital não confere com o registro. PDF não gerado.");
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const X = 20, W = 170, FOOT = 282, LH = 5.6, INK = [17, 17, 17], GRAY = [110, 110, 110], url = vurl(d.code);
    const { o: OP, lines: BL } = parseBody(S(d.body));
    const BAN = OP.banner ? rgb(OP.banner) : null;
    const BTX = BAN && (0.299 * BAN[0] + 0.587 * BAN[1] + 0.114 * BAN[2]) > 160 ? [0, 0, 0] : [255, 255, 255];
    let ttl = [];
    if (BAN) { doc.setFont("helvetica", "bold"); doc.setFontSize(15); ttl = doc.splitTextToSize(S(d.title.toUpperCase()), W); }
    const H1 = BAN ? Math.max(24, 12 + ttl.length * 7) : 24;
    let y = BAN ? H1 + 12 : 36;
    const col = c => doc.setTextColor(c[0], c[1], c[2]);
    const cs = n => { if (doc.setCharSpace) doc.setCharSpace(n); };
    const need = h => { if (y + h > FOOT - 4) { doc.addPage(); y = 28; } };
    const lab = (t, x, yy, sz, c, f) => { doc.setFont(f || "courier", "bold"); doc.setFontSize(sz); col(c); cs(0.5); doc.text(S(t), x, yy); cs(0); };
    const para = (t, x, w, sz, font, c, lh) => {
      doc.setFont("helvetica", font); doc.setFontSize(sz); col(c);
      for (const ln of doc.splitTextToSize(S(t), w)) { need(lh); doc.text(ln, x, y); y += lh; }
    };
    const qr = (text, x, yy, size) => {
      const q = window.qrcode(0, "M"); q.addData(text); q.make();
      const n = q.getModuleCount(), m = size / n;
      doc.setFillColor(0, 0, 0);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) doc.rect(x + c * m, yy + r * m, m + 0.03, m + 0.03, "F");
    };

    /* rótulo, título e dados */
    if (!BAN) {
      doc.setFillColor(...LIME); doc.rect(X, y - 2.6, 7, 1.3, "F");
      lab(kind(d).toUpperCase(), X + 10, y, 8, INK);
      y += 10;
      para(d.title.toUpperCase(), X, W, 19, "bold", [0, 0, 0], 8.4);
      y += 4;
    }
    const row = (k, v, mono) => {
      const f = mono ? "courier" : "helvetica", st = mono ? "bold" : "normal";
      doc.setFont(f, st); doc.setFontSize(10);
      const L = doc.splitTextToSize(S(v), W - 32), h = Math.max(1, L.length) * 5.2 + 5;
      need(h + 1);
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2); doc.line(X, y, X + W, y);
      lab(k, X, y + 5.2, 6.8, GRAY);
      doc.setFont(f, st); doc.setFontSize(10); col(INK);
      L.forEach((ln, i) => doc.text(ln, X + 32, y + 5.2 + i * 5.2));
      y += h;
    };
    if (d.recipient) row("PARA", d.recipient);
    row("EMITIDO EM", fdt(d.issued_at));
    row("CÓDIGO", d.code, true);
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2); doc.line(X, y, X + W, y);
    y += 11;

    /* tabela: primeira linha = cabeçalho; repete o cabeçalho em cada página */
    const drawTable = rows => {
      const nc = Math.max(1, ...rows.map(r => r.length)), NW = OP.num ? 9 : 0, FS = 8.8, PD = 2, TL = 4.1;
      const get = (r, c) => S(r[c] || "");
      const nat = [];
      for (let c = 0; c < nc; c++) {
        let m = 0;
        rows.forEach((r, i) => { doc.setFont("helvetica", i ? "normal" : "bold"); doc.setFontSize(FS); m = Math.max(m, doc.getTextWidth(get(r, c))); });
        nat.push(Math.max(12, m + PD * 2 + 1));
      }
      const sum = nat.reduce((a, b) => a + b, 0), wd = nat.map(w => w * (W - NW) / sum);
      const ws = OP.num ? [NW].concat(wd) : wd;
      const line = r => Array.from({ length: nc }, (_, c) => get(r, c));
      const hd = (OP.num ? [""] : []).concat(line(rows[0]));
      const put = (cl, head) => {
        doc.setFont("helvetica", head ? "bold" : "normal"); doc.setFontSize(FS);
        const L = cl.map((t, i) => doc.splitTextToSize(t, ws[i] - PD * 2)), h = Math.max(...L.map(a => a.length || 1)) * TL + PD * 1.8;
        if (y + h > FOOT - 4) { doc.addPage(); y = 22; if (!head) put(hd, true); }
        doc.setFont("helvetica", head ? "bold" : "normal"); doc.setFontSize(FS); col(INK);
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
        if (head) { doc.setFillColor(238, 238, 238); doc.rect(X, y, W, h, "FD"); } else doc.rect(X, y, W, h);
        let x = X;
        L.forEach((ln, i) => {
          const mid = head || (OP.num && i === 0);
          if (i) doc.line(x, y, x, y + h);
          ln.forEach((t, k) => doc.text(t, mid ? x + ws[i] / 2 : x + PD, y + PD + 2.8 + k * TL, mid ? { align: "center" } : undefined));
          x += ws[i];
        });
        y += h;
      };
      put(hd, true);
      rows.slice(1).forEach((r, k) => put((OP.num ? [String(k + 1)] : []).concat(line(r)), false));
      y += 5;
    };

    /* corpo: "# título", "## subtítulo", "- item", "|tabela", linha em branco separa parágrafos */
    let buf = [], tb = [];
    const flush = () => { if (buf.length) { para(buf.join(" "), X, W, 10.5, "normal", INK, LH); y += 2.6; buf = []; } };
    for (const raw of BL) {
      const t = raw.trim();
      if (t[0] === "|") { flush(); tb.push(cells(t)); continue; }
      if (tb.length) { drawTable(tb); tb = []; }
      if (!t) { flush(); continue; }
      if (/^##\s+/.test(t)) { flush(); y += 1.5; need(14); para(t.replace(/^##\s+/, ""), X, W, 11, "bold", INK, 5.8); y += 0.8; }
      else if (/^#\s+/.test(t)) { flush(); y += 3; need(16); para(t.replace(/^#\s+/, "").toUpperCase(), X, W, 12.5, "bold", [0, 0, 0], 6.2); y += 1.2; }
      else if (/^[-*]\s+/.test(t)) {
        flush(); need(LH);
        doc.setFillColor(0, 0, 0); doc.rect(X + 1, y - 2.2, 1.4, 1.4, "F");
        para(t.replace(/^[-*]\s+/, ""), X + 6, W - 6, 10.5, "normal", INK, LH); y += 1.2;
      } else buf.push(t);
    }
    flush();
    if (tb.length) drawTable(tb);

    /* assinatura */
    y += 8; need(30);
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.line(X, y, X + 24, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); col([0, 0, 0]); doc.text(S(d.signer_name), X, y + 7);
    if (d.signer_role) { doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); col(GRAY); doc.text(S(d.signer_role), X, y + 12); }
    y += 24;

    /* bloco de autenticação */
    need(50);
    const bh = 46;
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.35); doc.rect(X, y, W, bh);
    doc.setFillColor(...LIME); doc.rect(X, y, 2.4, bh, "F");
    qr(url, X + 8, y + 7, 32);
    const x0 = X + 46, tw = W - 50;
    lab("DOCUMENTO AUTENTICADO", x0, y + 8, 7.5, [0, 0, 0]);
    let ty = y + 13.5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.6); col([60, 60, 60]);
    const D = doc.splitTextToSize(S("Para conferir, leia o QR Code ou acesse o endereço abaixo. A página mostra se este código foi emitido pelo Arquivo da Responsabilidade e se continua válido."), tw);
    D.forEach((ln, i) => doc.text(ln, x0, ty + i * 4.1));
    ty += D.length * 4.1 + 2.2;
    doc.setFont("courier", "bold"); doc.setFontSize(7.4); col([0, 0, 0]);
    const U = doc.splitTextToSize(S(url), tw);
    U.forEach((ln, i) => doc.text(ln, x0, ty + i * 3.9));
    ty += U.length * 3.9 + 1.8;
    doc.setFontSize(8); doc.text(S("CÓD. " + d.code), x0, ty);
    ty += 4.6;
    doc.setFont("courier", "normal"); doc.setFontSize(6.6); col(GRAY);
    doc.text("SHA-256 " + d.content_hash, x0, ty);
    y += bh;

    /* cabeçalho e rodapé de todas as páginas */
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      const first = i === 1, h = first ? H1 : 12, s = first ? 9 : 6, sy = (h - s) / 2, ly = h / 2 + (first ? 1.2 : 0.9);
      doc.setFillColor(...(BAN || [0, 0, 0])); doc.rect(0, 0, 210, h, "F");
      if (BAN && first) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); col(BTX);
        const t0 = (h - ttl.length * 7) / 2 + 5.3;
        ttl.forEach((ln, k) => doc.text(ln, 105, t0 + k * 7, { align: "center" }));
      } else {
        if (!BAN) {
          doc.setFillColor(...LIME); doc.rect(0, h, 210, 0.9, "F"); doc.rect(X, sy, s, s, "F");
          doc.setFont("helvetica", "bold"); doc.setFontSize(first ? 11 : 8); col([0, 0, 0]);
          doc.text("A", X + s / 2, sy + s / 2 + (first ? 1.5 : 1.1), { align: "center" });
        }
        doc.setFont("helvetica", "bold"); cs(first ? 0.9 : 0.7); doc.setFontSize(first ? 8.5 : 6.5); col(BAN ? BTX : [255, 255, 255]);
        doc.text("ARQUIVO DA RESPONSABILIDADE", BAN ? X : X + s + 4, ly); cs(0);
        doc.setFont("courier", "bold"); doc.setFontSize(first ? 8 : 6.5); col(BAN ? BTX : first ? LIME : [150, 150, 150]);
        doc.text(S(first ? kind(d).toUpperCase() : d.code), X + W, ly, { align: "right" });
      }
      doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.2); doc.line(X, FOOT, X + W, FOOT);
      doc.setFont("courier", "normal"); doc.setFontSize(6.8); col(GRAY);
      doc.text(S(d.code + "  ·  SHA-256 " + d.content_hash.slice(0, 16) + "..."), X, FOOT + 5);
      doc.text("PÁG. " + i + "/" + n, X + W, FOOT + 5, { align: "right" });
    }
    doc.setProperties({
      title: S(d.title), subject: "Documento autenticado " + d.code, author: "Arquivo da Responsabilidade",
      keywords: d.code + ", sha256:" + d.content_hash, creator: "Arquivo da Responsabilidade"
    });
    doc.save(d.code + ".pdf");
  }

  /* ---------- modelos ---------- */
  const MK = "arq_modelos_v1";
  const mine = () => { try { const a = JSON.parse(localStorage.getItem(MK) || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; } };
  const keep = a => { try { localStorage.setItem(MK, JSON.stringify(a)); return true; } catch (_) { return false; } };
  const BUILTIN = [
    { n: "Ofício", mode: "doc", type: "oficio", title: "Ofício nº [número]/[ano] - [assunto]", recipient: "[Nome e cargo de quem recebe]",
      body: "Prezado(a) [nome],\n\nDirijo-me a Vossa Senhoria para [objetivo do ofício].\n\n## Contexto\n[Descreva o fato ou a situação em poucas linhas.]\n\n## Solicitação\n- [Item 1]\n- [Item 2]\n\nColoco-me à disposição para esclarecimentos e aguardo retorno até [data].\n\nAtenciosamente," },
    { n: "Declaração", mode: "doc", type: "declaracao", title: "Declaração de [finalidade]",
      body: "Declaro, para os devidos fins, que [nome completo], [qualificação], [fato declarado].\n\nPor ser expressão da verdade, firmo a presente declaração." },
    { n: "Comunicado", mode: "doc", type: "comunicado", title: "Comunicado: [assunto]",
      body: "# [Assunto]\n\n[Resumo do que está sendo comunicado.]\n\n## O que muda\n- [Ponto 1]\n- [Ponto 2]\n\n## Prazo\n[Data ou período.]" },
    { n: "Lista de uniformes (banner azul)", mode: "lst", type: "relatorio", title: "Lista de uniformes da interclasse", sub: "Turma: [série e turma]",
      cols: "Aluno, Nome, Número, Tamanho", rows: "", num: true, style: "ban", color: "#3a4590" },
    { n: "Lista de presença", mode: "lst", type: "relatorio", title: "Lista de presença - [evento]", sub: "Data: [dd/mm/aaaa]",
      cols: "Nome, Assinatura", rows: "", num: true, style: "pad", color: "#3a4590" }
  ];
  const allM = () => BUILTIN.concat(mine().map(m => ({ ...m, mine: true })));

  /* ---------- tela do painel ---------- */
  async function loadList() {
    const box = $("dl"), owner = ME.role === "owner";
    const { data, error } = await SB.from("documents").select("*").order("issued_at", { ascending: false }).limit(100);
    if (error) { box.innerHTML = '<div class="item"><p>' + esc(errMsg(error)) + "</p></div>"; return; }
    LIST = data || [];
    box.innerHTML = '<div class="item"><div class="lab" style="margin:0">Emitidos (' + LIST.length + ")</div></div>" +
      (LIST.length ? LIST.map(d => `<div class="item"><div class="m"><span>${kind(d)} · ${esc(dBR(d.issued_at))}</span><b class="${d.revoked_at ? "pii" : ""}">${d.revoked_at ? "Revogado" : "Válido"}</b></div>
<h3>${esc(d.title)}</h3><div class="w2">${esc(d.code)}${d.public_text ? " · texto público" : ""}</div>
<div class="acts">${d.revoked_at ? "" : `<button data-d="pdf" data-id="${d.id}">Baixar PDF</button>`}<button data-d="lk" data-id="${d.id}">Copiar link</button>${owner && !d.revoked_at ? `<button data-d="rv" data-id="${d.id}">Revogar</button>` : ""}</div></div>`).join("")
        : '<div class="item empty"><p>Nenhum documento emitido ainda.</p></div>');
  }

  async function renderDocs() {
    const aq = $("aq"), owner = ME.role === "owner";
    aq.onclick = null;
    aq.innerHTML = '<div class="item"><p>Carregando…</p></div>';
    await loadSettings();
    const TO = Object.entries(TY).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    aq.innerHTML = `<div class="item"><div class="lab" style="margin-bottom:6px">Novo documento</div>
<p class="sm">Cada documento recebe código único, QR Code e impressão digital (SHA-256). Depois de emitido, o texto não pode ser editado: para corrigir, emita outro.</p>
<label class="fl" for="dmo">Modelo</label><div class="f"><select id="dmo"></select></div>
<div class="acts"><button type="button" id="dms">Salvar como modelo</button><button type="button" id="dmx" hidden>Excluir modelo</button></div>
<p class="sm" style="margin-top:8px">Os modelos que você salva ficam neste navegador.</p>
<label class="fl" for="dmd">Formato</label><div class="f"><select id="dmd"><option value="doc">Documento de texto</option><option value="lst">Lista (tabela)</option></select></div>
<label class="fl" for="dty">Tipo</label><div class="f"><select id="dty">${TO}</select></div>
<label class="fl" for="dti">Título</label><div class="f"><input id="dti" maxlength="160" placeholder="Assunto do documento"></div>
<label class="fl" for="dre">Destinatário (opcional)</label><div class="f"><input id="dre" maxlength="200" placeholder="A quem o documento se dirige"></div>
<div id="bdoc"><label class="fl" for="dbo">Texto</label><div class="f"><textarea id="dbo" rows="12" maxlength="20000" placeholder="Escreva o documento"></textarea></div>
<p class="sm" style="margin-top:8px"># Título · ## Subtítulo · - item de lista · linha em branco separa parágrafos</p></div>
<div id="blst" hidden><label class="fl" for="dls">Subtítulo (opcional)</label><div class="f"><input id="dls" maxlength="160" placeholder="Ex.: Turma: 8º ano A"></div>
<label class="fl" for="dlc">Colunas (separadas por vírgula)</label><div class="f"><input id="dlc" maxlength="200" placeholder="Aluno, Nome, Número, Tamanho"></div>
<label class="fl" for="dlr">Linhas</label><div class="f"><textarea id="dlr" rows="10" maxlength="19000" placeholder="Uma linha por pessoa. Separe as colunas com ; ou cole direto de uma planilha.&#10;MARIA SOUZA;MARI;10;P"></textarea></div>
<label class="chk"><input type="checkbox" id="dln">Numerar as linhas (1, 2, 3…)</label>
<label class="fl" for="dvs">Visual</label><div class="f"><select id="dvs"><option value="pad">Padrão (preto e lima)</option><option value="ban">Banner colorido</option></select></div>
<div id="dcw" hidden><label class="fl" for="dcr">Cor do banner</label><input id="dcr" type="color" value="#3a4590" style="display:block;margin-top:8px;width:64px;height:40px;background:none;border:1px solid #555;padding:2px"></div></div>
<label class="fl" for="dsg">Assinado por</label><div class="f"><input id="dsg" maxlength="120" placeholder="Nome de quem assina"></div>
<label class="fl" for="drl">Cargo ou função (opcional)</label><div class="f"><input id="drl" maxlength="120" placeholder="Ex.: Coordenação editorial"></div>
<label class="chk"><input type="checkbox" id="dpb">Mostrar o texto completo na página pública de verificação</label>
<button class="btn" id="dgo" type="button">Emitir e baixar PDF</button>
<p class="sm" id="dm" style="margin-top:12px" aria-live="polite"></p>
<p class="sm" style="margin-top:6px;word-break:break-all">O QR Code aponta para: ${esc(vurl("ARQ-XXXX-XXXX-XXXX"))}</p></div>
${owner ? `<div class="item"><label class="fl" style="margin-top:0" for="dsu">Endereço público do site (usado no QR Code)</label><div class="f"><input id="dsu" type="url" value="${esc(ST.site_url || "")}" placeholder="https://seusite.com.br"></div>
<button class="btn o" id="dsb" type="button" style="margin-top:14px">Salvar endereço</button><p class="sm" id="dsm" style="margin-top:10px" aria-live="polite"></p></div>` : ""}
<div id="dl"></div>`;
    aq.querySelectorAll(".f select").forEach(mkSel);

    const setSel = (id, v) => { const e = $(id); e.value = v; const b = e.closest(".f").querySelector(".cs-b"); if (b) b.textContent = e.options[e.selectedIndex].text; };
    const sync = () => {
      const l = $("dmd").value === "lst";
      $("bdoc").hidden = l; $("blst").hidden = !l; $("dcw").hidden = !(l && $("dvs").value === "ban");
    };
    const fill = m => {
      setSel("dmd", m.mode || "doc"); setSel("dty", m.type || "oficio");
      $("dti").value = m.title || ""; $("dre").value = m.recipient || ""; $("dbo").value = m.body || "";
      $("dsg").value = m.signer || ""; $("drl").value = m.role || "";
      $("dls").value = m.sub || ""; $("dlc").value = m.cols || ""; $("dlr").value = m.rows || ""; $("dln").checked = !!m.num;
      setSel("dvs", m.style === "ban" ? "ban" : "pad"); $("dcr").value = m.color || "#3a4590";
      sync();
    };
    const cur = () => ({ mode: $("dmd").value, type: $("dty").value, title: $("dti").value.trim(), recipient: $("dre").value.trim(), body: $("dbo").value,
      signer: $("dsg").value.trim(), role: $("drl").value.trim(), sub: $("dls").value.trim(), cols: $("dlc").value.trim(), rows: $("dlr").value,
      num: $("dln").checked, style: $("dvs").value, color: $("dcr").value });
    const fillModels = pick => {
      const sel = $("dmo");
      sel.innerHTML = '<option value="">Em branco</option>' + allM().map((m, i) => `<option value="${i}">${m.mine ? "★ " : ""}${esc(m.n)}</option>`).join("");
      setSel("dmo", pick == null ? "" : String(pick));
      $("dmx").hidden = !(pick != null && allM()[pick] && allM()[pick].mine);
    };
    fillModels();
    $("dmd").onchange = sync; $("dvs").onchange = sync;
    $("dmo").onchange = () => {
      const v = $("dmo").value, m = v === "" ? {} : allM()[+v];
      if (!m) return;
      const dirty = [$("dti"), $("dbo"), $("dlr")].some(e => e.value.trim());
      if (dirty && !confirm("Aplicar o modelo substitui o que você já escreveu. Continuar?")) { fillModels(); return; }
      fill(m); $("dmx").hidden = !m.mine;
    };
    $("dms").onclick = () => {
      const n = (prompt("Nome do modelo:") || "").trim().slice(0, 60); if (!n) return;
      const a = mine(), i = a.findIndex(x => x.n === n), c = { ...cur(), n };
      if (i >= 0) { if (!confirm("Já existe um modelo com esse nome. Substituir?")) return; a[i] = c; }
      else { if (a.length >= 30) { alert("Limite de 30 modelos salvos. Exclua algum antes."); return; } a.push(c); }
      if (!keep(a)) { alert("Este navegador não permitiu salvar o modelo."); return; }
      fillModels(BUILTIN.length + a.findIndex(x => x.n === n));
      $("dm").textContent = "Modelo salvo: " + n + ".";
    };
    $("dmx").onclick = () => {
      const m = allM()[+$("dmo").value]; if (!m || !m.mine) return;
      if (!confirm("Excluir o modelo " + m.n + "?")) return;
      keep(mine().filter(x => x.n !== m.n)); fillModels();
    };

    $("dgo").onclick = async () => {
      const m = $("dm"), g = id => $(id).value.trim(), t = g("dti"), sg = g("dsg");
      let bo = $("dbo").value.trim();
      if (t.length < 5) { m.textContent = "O título precisa de pelo menos 5 caracteres."; return; }
      if ($("dmd").value === "lst") {
        const cl = x => x.trim().replace(/[|\n\r]/g, "/");
        const cols = g("dlc").split(",").map(cl).filter(Boolean);
        const rows = $("dlr").value.split("\n").map(l => l.split(/\t|;/).map(cl)).filter(r => r.some(Boolean));
        if (!cols.length) { m.textContent = "Informe as colunas da lista, separadas por vírgula."; return; }
        if (!rows.length) { m.textContent = "Escreva pelo menos uma linha da lista."; return; }
        const sub = g("dls").replace(/[\n\r]/g, " ");
        bo = [$("dln").checked ? "@num" : "", $("dvs").value === "ban" ? "@banner " + $("dcr").value.toUpperCase() : "",
          sub ? "## " + sub : "", "|" + cols.join("|")].concat(rows.map(r => "|" + r.join("|"))).filter(Boolean).join("\n");
        if (bo.length > 20000) { m.textContent = "A lista passou do limite de 20 mil caracteres. Divida em duas listas."; return; }
      } else if (bo.length < 20) { m.textContent = "Escreva o texto do documento (mínimo de 20 caracteres)."; return; }
      if (sg.length < 3) { m.textContent = "Informe quem assina o documento."; return; }
      $("dgo").disabled = true; m.textContent = "Emitindo…";
      const { data, error } = await SB.rpc("issue_document", {
        p_type: $("dty").value, p_title: t, p_recipient: g("dre") || null, p_body: bo,
        p_signer: sg, p_role: g("drl") || null, p_public: $("dpb").checked
      });
      if (error || !data) { $("dgo").disabled = false; m.textContent = errMsg(error); return; }
      try { await makePDF(data); m.textContent = "Emitido: " + data.code + ". O PDF foi baixado."; }
      catch (x) { m.textContent = "Emitido (" + data.code + "), mas o PDF falhou: " + x.message + " Use Baixar PDF na lista."; }
      $("dgo").disabled = false;
      ["dti", "dre", "dbo", "dlr"].forEach(i => $(i).value = ""); $("dpb").checked = false;
      loadList();
    };

    if (owner) $("dsb").onclick = async () => {
      const u = $("dsu").value.trim().replace(/\/+$/, ""), m = $("dsm");
      if (!/^https:\/\/[^\s/]+$/.test(u)) { m.textContent = "Use só o endereço, começando com https:// (ex.: https://seusite.com.br)."; return; }
      const { error } = await SB.from("site_settings").upsert([{ key: "site_url", value: u }]);
      m.textContent = error ? "Erro: " + error.message : "Salvo.";
      if (!error) { ST.site_url = u; }
    };

    aq.onclick = async e => {
      const b = e.target.closest("[data-d]"); if (!b) return;
      const d = LIST.find(x => x.id === b.dataset.id); if (!d) return;
      if (b.dataset.d === "pdf") {
        b.disabled = true;
        try { await makePDF(d); } catch (x) { alert(x.message); }
        b.disabled = false;
      } else if (b.dataset.d === "lk") {
        try { await navigator.clipboard.writeText(vurl(d.code)); b.textContent = "Link copiado"; }
        catch (_) { prompt("Copie o link de verificação:", vurl(d.code)); }
      } else if (b.dataset.d === "rv") {
        const r = prompt("Motivo interno da revogação (não aparece no site):"); if (!r) return;
        if (!confirm("Revogar " + d.code + "? A página pública passa a mostrar o documento como revogado. Não dá para desfazer.")) return;
        const { error } = await SB.rpc("revoke_document", { p_id: d.id, p_reason: r });
        if (error) { alert(errMsg(error)); return; }
        loadList();
      }
    };
    loadList();
  }

  window.Docs = { render: renderDocs, pdf: makePDF, canon, sha, S };
})();
