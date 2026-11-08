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
    let y = 36;
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
    doc.setFillColor(...LIME); doc.rect(X, y - 2.6, 7, 1.3, "F");
    lab(TY[d.doc_type].toUpperCase(), X + 10, y, 8, INK);
    y += 10;
    para(d.title.toUpperCase(), X, W, 19, "bold", [0, 0, 0], 8.4);
    y += 4;
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

    /* corpo: "# título", "## subtítulo", "- item", linha em branco separa parágrafos */
    let buf = [];
    const flush = () => { if (buf.length) { para(buf.join(" "), X, W, 10.5, "normal", INK, LH); y += 2.6; buf = []; } };
    for (const raw of S(d.body).split("\n")) {
      const t = raw.trim();
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
      const first = i === 1, h = first ? 24 : 12, s = first ? 9 : 6, sy = (h - s) / 2, ly = h / 2 + (first ? 1.2 : 0.9);
      doc.setFillColor(0, 0, 0); doc.rect(0, 0, 210, h, "F");
      doc.setFillColor(...LIME); doc.rect(0, h, 210, 0.9, "F"); doc.rect(X, sy, s, s, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(first ? 11 : 8); col([0, 0, 0]);
      doc.text("A", X + s / 2, sy + s / 2 + (first ? 1.5 : 1.1), { align: "center" });
      cs(first ? 0.9 : 0.7); doc.setFontSize(first ? 8.5 : 6.5); col([255, 255, 255]);
      doc.text("ARQUIVO DA RESPONSABILIDADE", X + s + 4, ly); cs(0);
      doc.setFont("courier", "bold"); doc.setFontSize(first ? 8 : 6.5); col(first ? LIME : [150, 150, 150]);
      doc.text(S(first ? TY[d.doc_type].toUpperCase() : d.code), X + W, ly, { align: "right" });
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

  /* ---------- tela do painel ---------- */
  async function loadList() {
    const box = $("dl"), owner = ME.role === "owner";
    const { data, error } = await SB.from("documents").select("*").order("issued_at", { ascending: false }).limit(100);
    if (error) { box.innerHTML = '<div class="item"><p>' + esc(errMsg(error)) + "</p></div>"; return; }
    LIST = data || [];
    box.innerHTML = '<div class="item"><div class="lab" style="margin:0">Emitidos (' + LIST.length + ")</div></div>" +
      (LIST.length ? LIST.map(d => `<div class="item"><div class="m"><span>${TY[d.doc_type] || ""} · ${esc(dBR(d.issued_at))}</span><b class="${d.revoked_at ? "pii" : ""}">${d.revoked_at ? "Revogado" : "Válido"}</b></div>
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
<label class="fl" for="dty">Tipo</label><div class="f"><select id="dty">${TO}</select></div>
<label class="fl" for="dti">Título</label><div class="f"><input id="dti" maxlength="160" placeholder="Assunto do documento"></div>
<label class="fl" for="dre">Destinatário (opcional)</label><div class="f"><input id="dre" maxlength="200" placeholder="A quem o documento se dirige"></div>
<label class="fl" for="dbo">Texto</label><div class="f"><textarea id="dbo" rows="12" maxlength="20000" placeholder="Escreva o documento"></textarea></div>
<p class="sm" style="margin-top:8px"># Título · ## Subtítulo · - item de lista · linha em branco separa parágrafos</p>
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

    $("dgo").onclick = async () => {
      const m = $("dm"), g = id => $(id).value.trim(), t = g("dti"), bo = $("dbo").value.trim(), sg = g("dsg");
      if (t.length < 5) { m.textContent = "O título precisa de pelo menos 5 caracteres."; return; }
      if (bo.length < 20) { m.textContent = "Escreva o texto do documento (mínimo de 20 caracteres)."; return; }
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
      ["dti", "dre", "dbo"].forEach(i => $(i).value = ""); $("dpb").checked = false;
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
