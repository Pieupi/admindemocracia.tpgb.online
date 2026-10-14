"use strict";
/* Área restrita. Só funciona para quem está em "admins", com senha + autenticador (2 etapas). */
const CFG={url:"https://eujarfnrumuxsdeahosi.supabase.co",key:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1amFyZm5ydW11eHNkZWFob3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MTIyNTIsImV4cCI6MjEwNzA4ODI1Mn0.TeMWaPLWIkko0vlxCKREq9pJ4Pwz9ZTonSHK0OfIfsQ",idleMin:15,minPass:12};
const SBU=CFG.url,SBK=CFG.key;
const SB=window.supabase.createClient(SBU,SBK,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=i=>document.getElementById(i),esc=s=>String(s==null?"":s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const TD=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
var ME=null,RECOVERY=false,IDLE=null,FAILS=0,IDLEON=false,ST={},AS="dash";
function load(){}
async function loadSettings(){const{data}=await SB.from("site_settings").select("key,value");if(data)ST=Object.fromEntries(data.map(r=>[r.key,r.value]))}
const UFN={AC:"Acre",AL:"Alagoas",AP:"Amapá",AM:"Amazonas",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MT:"Mato Grosso",MS:"Mato Grosso do Sul",MG:"Minas Gerais",PA:"Pará",PB:"Paraíba",PR:"Paraná",PE:"Pernambuco",PI:"Piauí",RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RS:"Rio Grande do Sul",RO:"Rondônia",RR:"Roraima",SC:"Santa Catarina",SP:"São Paulo",SE:"Sergipe",TO:"Tocantins",BR:"Nacional / online"};
const C={d:"Desinformação",o:"Discurso de ódio",s:"Supressão de votos",a:"Ameaça institucional",v:"Violência política"};
const CK={d:"desinformacao",o:"odio",s:"supressao",a:"ameaca",v:"violencia"},CM=Object.fromEntries(Object.entries(CK).map(([a,b])=>[b,a])),SL={approved:"Registrada",verified:"Verificada",resolved:"Resolvida"};
const fdate=d=>new Date(d+"T00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"});
function mkSel(sel){const w=sel.closest(".f");w.classList.add("cs");sel.hidden=true;
const b=document.createElement("button");b.type="button";b.className="cs-b";b.setAttribute("aria-haspopup","listbox");b.setAttribute("aria-expanded","false");
const l=document.createElement("ul");l.className="cs-l";l.setAttribute("role","listbox");l.hidden=true;w.append(b,l);
const lb=document.querySelector('label[for="'+sel.id+'"]');if(lb)b.setAttribute("aria-label",lb.textContent);
let act=-1;const items=()=>[...l.children];
function render(){b.textContent=sel.options[sel.selectedIndex].text;l.innerHTML=[...sel.options].map((o,i)=>`<li role="option" data-i="${i}" aria-selected="${i==sel.selectedIndex}">${esc(o.text)}</li>`).join("")}
function mark(){items().forEach((li,i)=>li.classList.toggle("act",i==act));const a=items()[act];if(a)a.scrollIntoView({block:"nearest"})}
function open(){render();l.hidden=false;b.setAttribute("aria-expanded","true");act=sel.selectedIndex;l.classList.remove("up");const r=l.getBoundingClientRect();if(r.bottom>innerHeight-8&&b.getBoundingClientRect().top>r.height+16)l.classList.add("up");mark()}
function close(){l.hidden=true;b.setAttribute("aria-expanded","false")}
function pick(i){sel.selectedIndex=i;sel.dispatchEvent(new Event("input",{bubbles:true}));sel.dispatchEvent(new Event("change",{bubbles:true}));render();close();b.focus()}
b.onclick=()=>l.hidden?open():close();
l.onclick=e=>{const li=e.target.closest("li");if(li)pick(+li.dataset.i)};
b.onkeydown=e=>{const n=sel.options.length;if(e.key=="ArrowDown"||e.key=="ArrowUp"){e.preventDefault();if(l.hidden)open();else{act=(act+(e.key=="ArrowDown"?1:-1)+n)%n;mark()}}else if((e.key=="Enter"||e.key==" ")&&!l.hidden){e.preventDefault();pick(act)}else if(e.key=="Escape"||e.key=="Tab")close()};
document.addEventListener("click",e=>{if(!w.contains(e.target))close()});render()}
function renderNew(){const UO=Object.entries(UFN).map(([k,v])=>`<option value="${k}">${v}</option>`).join(""),o=Object.entries(C).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
$("aq").innerHTML=`<div class="item"><label class="fl" style="margin-top:0" for="nt">Título (manchete)</label><div class="f"><input id="nt" maxlength="140" placeholder="Resuma em uma frase"></div>
<label class="fl" for="nc">Categoria</label><div class="f"><select id="nc">${o}</select></div>
<label class="fl" for="nr">Região</label><div class="f"><input id="nr" placeholder="Cidade e estado"></div>
<label class="fl" for="nuf">Estado</label><div class="f"><select id="nuf">${UO}</select></div>
<label class="fl" for="nd">Data do fato</label><div class="f"><input id="nd" type="date" min="2020-01-01" max="${TD()}"></div>
<label class="fl" for="nx">Resumo (opcional)</label><div class="f"><textarea id="nx" rows="3" placeholder="Pode ficar vazio para uma manchete"></textarea></div>
<label class="fl" for="nbd">Texto estendido (opcional)</label><div class="f"><textarea id="nbd" rows="5" placeholder="Versão completa, aberta em Ler registro completo"></textarea></div>
<label class="fl" for="nl">Link do botão (opcional)</label><div class="f"><input id="nl" type="url" placeholder="https://"></div>
<label class="fl" for="nlb">Texto do botão</label><div class="f"><input id="nlb" maxlength="40" placeholder="Ex.: Ler matéria"></div>
<label class="fl" for="nca">Ao clicar no registro</label><div class="f"><select id="nca"><option value="none">Nada</option><option value="link">Abrir o link</option><option value="page">Abrir a versão completa</option></select></div>
<label class="fl" for="nu">Link da prova (opcional)</label><div class="f"><input id="nu" type="url" placeholder="https://"></div>
<label class="fl" for="nou">Fonte oficial (opcional)</label><div class="f"><input id="nou" type="url" placeholder="Link da decisão (TSE, STF, MP, PF)"></div>
<label class="fl" for="non">O que a decisão afirma (opcional)</label><div class="f"><textarea id="non" rows="3" maxlength="400" placeholder="Resumo fiel, citando o órgão e o número do processo"></textarea></div>
<label class="fl" for="ns">Publicar como</label><div class="f"><select id="ns"><option value="approved">Registrada</option><option value="verified">Verificada</option><option value="resolved">Resolvida</option></select></div>
<button class="btn" id="nb" type="button" style="margin-top:22px">Publicar registro</button><p class="sm" id="nm" style="margin-top:12px" aria-live="polite"></p></div>`;
$("aq").querySelectorAll(".f select").forEach(mkSel);
$("nb").onclick=async()=>{const t=$("nt").value.trim(),r=$("nr").value.trim(),ev=$("nd").value,d=$("nx").value.trim(),bd=$("nbd").value.trim(),lk=$("nl").value.trim(),ca=$("nca").value,m=$("nm");
if(t.length<8||!r||!ev){m.textContent="Preencha título (mín. 8 caracteres), região e data.";return}
if(ev<"2020-01-01"||ev>TD()){m.textContent="Confira a data: ela não pode ser futura.";return}
if(lk&&!/^https:\/\//.test(lk)){m.textContent="O link precisa começar com https://";return}
if(ca=="link"&&!lk){m.textContent="Informe o link para usar essa ação.";return}
if(ca=="page"&&!bd){m.textContent="Escreva o texto estendido para usar essa ação.";return}
const ou=$("nou").value.trim(),on=$("non").value.trim();
if(ou&&!/^https:\/\//.test(ou)){m.textContent="A fonte oficial precisa começar com https://";return}
if(on&&!ou){m.textContent="Para exibir a decisão, informe o link da fonte oficial.";return}
$("nb").disabled=true;const{data:{user}}=await SB.auth.getUser();
const{data,error}=await SB.from("reports").insert({user_id:user.id,category:CK[$("nc").value],title:t,description:d,region:r,event_date:ev,evidence_url:$("nu").value.trim()||null,public_fact:true,truth_declared:true,status:$("ns").value,uf:$("nuf").value,official_url:ou||null,official_note:on||null,body:bd||null,link_url:lk||null,link_label:$("nlb").value.trim()||null,click_action:ca}).select("pii_flag").single();$("nb").disabled=false;
if(error){m.textContent="Erro: "+error.message;return}
m.textContent=data.pii_flag?"Salvo, mas contém dado pessoal e não aparece no site até você editar.":"Publicado. Já aparece em Registros.";
["nt","nr","nd","nx","nbd","nl","nlb","nu","nou","non"].forEach(i=>$(i).value="");load()}}
async function renderFeedsAdmin(){$("aq").onclick=null;const{data}=await SB.from("feeds").select("*").order("created_at");
const rows=(data||[]).map(f=>`<div class="item"><div class="m"><span>${f.kind=="checagem"?"Checagem":"Notícia"}${f.active?"":" · pausada"}</span></div><h3>${esc(f.name)}</h3><div class="w2" style="word-break:break-all">${esc(f.url)}</div><div class="acts"><button data-f="toggle" data-id="${f.id}" data-v="${f.active}">${f.active?"Pausar":"Ativar"}</button><button data-f="del" data-id="${f.id}">Remover</button></div></div>`).join("");
$("aq").innerHTML=`<div class="item"><label class="fl" style="margin-top:0" for="fn">Nome da fonte</label><div class="f"><input id="fn" placeholder="Ex.: Agência Brasil"></div><label class="fl" for="fu">Endereço do feed (RSS)</label><div class="f"><input id="fu" type="url" placeholder="https://"></div><label class="fl" for="fk">Tipo</label><div class="f"><select id="fk"><option value="noticia">Notícia</option><option value="checagem">Checagem</option></select></div><button class="btn" id="fb" type="button" style="margin-top:22px">Adicionar fonte</button><button class="btn o" id="fs" type="button" style="margin-top:10px">Atualizar notícias agora</button><p class="sm" id="fm2" style="margin-top:12px" aria-live="polite"></p></div>`+rows;
$("aq").querySelectorAll(".f select").forEach(mkSel);
$("fb").onclick=async()=>{const n=$("fn").value.trim(),u=$("fu").value.trim();if(!n||!/^https:\/\//.test(u)){$("fm2").textContent="Informe o nome e um endereço que comece com https://";return}
const{error}=await SB.from("feeds").insert({name:n,url:u,kind:$("fk").value});if(error){$("fm2").textContent=error.code=="23505"?"Essa fonte já está cadastrada.":"Erro: "+error.message;return}renderFeedsAdmin()};
$("fs").onclick=async()=>{const m=$("fm2");m.textContent="Atualizando…";
try{const{data:{session}}=await SB.auth.getSession();const r=await fetch(SBU+"/functions/v1/sync-news",{method:"POST",headers:{Authorization:"Bearer "+(session?session.access_token:SBK),apikey:SBK,"Content-Type":"application/json"},body:"{}"});
let j={};try{j=await r.json()}catch(_){}
if(r.ok&&!j.error){const dt=(j.detalhes||[]).map(x=>x.fonte+": "+x.itens+" itens"+(x.motivo?" ("+x.motivo+")":"")).join(" · ");m.textContent="Pronto: "+(j.itens||0)+" itens processados."+(dt?" "+dt:"");return}
m.textContent=r.status==404?"A função sync-news não existe neste projeto (erro 404). Publique com o nome exato sync-news.":r.status==403?"Sem permissão (erro 403). Entre com a conta de moderador.":"Erro "+r.status+": "+(j.error||j.message||"sem detalhe")}
catch(e){m.textContent="Não consegui falar com a função. Ela provavelmente não foi publicada, está com erro ao iniciar ou o navegador bloqueou a chamada."}};
$("aq").onclick=async e=>{const b=e.target.closest("[data-f]");if(!b)return;if(b.dataset.f=="del"){if(!confirm("Remover esta fonte?"))return;await SB.from("feeds").delete().eq("id",b.dataset.id)}else{await SB.from("feeds").update({active:b.dataset.v!="true"}).eq("id",b.dataset.id)}renderFeedsAdmin()}}
async function renderLiveAdmin(){$("aq").onclick=null;await loadSettings();
$("aq").innerHTML=`<div class="item"><label class="fl" style="margin-top:0" for="lm">Modo</label><div class="f"><select id="lm"><option value="auto">Automático (pelas datas)</option><option value="on">Sempre ligado</option><option value="off">Desligado</option></select></div>
<label class="fl" for="lf">Disponível de</label><div class="f"><input id="lf" type="date" value="${esc(ST.live_from||"")}"></div>
<label class="fl" for="lt2">Até</label><div class="f"><input id="lt2" type="date" value="${esc(ST.live_to||"")}"></div>
<label class="fl" for="lu">Arquivo de resultado do TSE (Presidente)</label><div class="f"><input id="lu" type="url" value="${esc(ST.live_url||"")}" placeholder="https://resultados.tse.jus.br/.../br-c0001-e......-u.json"></div>
<label class="fl" for="ll">Título da página</label><div class="f"><input id="ll" value="${esc(ST.live_label||"")}" placeholder="Segundo turno · Presidente"></div>
<button class="btn" id="lb" type="button" style="margin-top:22px">Salvar</button><p class="sm" id="lmsg" style="margin-top:12px" aria-live="polite"></p></div>`;
$("lm").value=ST.live_mode||"auto";$("aq").querySelectorAll(".f select").forEach(mkSel);
$("lb").onclick=async()=>{const u=$("lu").value.trim();if(u&&!/^https:\/\/([a-z0-9-]+\.)*tse\.jus\.br\//.test(u)){$("lmsg").textContent="O endereço precisa ser de um site do TSE (tse.jus.br).";return}
const rows=[["live_mode",$("lm").value],["live_from",$("lf").value],["live_to",$("lt2").value],["live_url",u],["live_label",$("ll").value.trim()]].map(([key,value])=>({key,value}));
const{error}=await SB.from("site_settings").upsert(rows);$("lmsg").textContent=error?"Erro: "+error.message:"Salvo.";loadSettings()}}
async function renderMsgs(){$("aq").onclick=null;const{data,error}=await SB.from("contact_messages").select("*").order("created_at",{ascending:false}).limit(100);
if(error){$("aq").innerHTML='<div class="item"><p>Erro: '+esc(error.message)+'</p></div>';return}
$("aq").innerHTML=data.length?data.map(m=>`<div class="item"><div class="m"><span>${esc(m.subject)} · ${new Date(m.created_at).toLocaleString("pt-BR")}</span><b class="${m.handled?"":"pii"}">${m.handled?"Lida":"Nova"}</b></div><h3>${esc(m.name||"Sem nome")}${m.email?` · <a href="mailto:${esc(m.email)}?subject=${encodeURIComponent("Re: "+m.subject)}" style="color:var(--lime)">${esc(m.email)}</a>`:""}</h3><p style="white-space:pre-wrap">${esc(m.message)}</p><div class="acts">${m.handled?"":`<button data-c="done" data-id="${m.id}">Marcar como lida</button>`}<button data-c="del" data-id="${m.id}">Apagar</button></div></div>`).join(""):'<div class="item empty"><p>Nenhuma mensagem.</p></div>';
$("aq").onclick=async e=>{const b=e.target.closest("[data-c]");if(!b)return;if(b.dataset.c=="del"){if(!confirm("Apagar esta mensagem?"))return;await SB.from("contact_messages").delete().eq("id",b.dataset.id)}else await SB.from("contact_messages").update({handled:true}).eq("id",b.dataset.id);renderMsgs()}}
async function loadQ(){if(AS=="dash"){renderDash();return}if(AS=="team"){renderTeam();return}if(AS=="audit"){renderAudit();return}if(AS=="sec"){renderSec();return}if(AS=="new"){renderNew();return}if(AS=="feeds"){renderFeedsAdmin();return}if(AS=="live"){renderLiveAdmin();return}if(AS=="msgs"){renderMsgs();return}const{data,error}=await SB.from("reports").select("*").eq("status",AS).order("created_at",{ascending:true}).limit(100);
if(error){$("aq").innerHTML='<div class="item"><p>Erro ao carregar a fila.</p></div>';return}
const B={pending:["approved","verified","rejected"],approved:["verified","resolved","rejected"],verified:["resolved","rejected"],resolved:[],rejected:["approved"]};
const BL={approved:"Aprovar",verified:"Verificar",resolved:"Resolver",rejected:"Rejeitar"};
$("aq").innerHTML=data.length?data.map(r=>`<div class="item" data-id="${r.id}"><div class="m"><span>${fdate(r.event_date)} · ${esc(r.region)}</span><b class="${r.pii_flag?"pii":""}">${r.pii_flag?"DADOS PESSOAIS":C[CM[r.category]]}</b></div>
<textarea class="et" rows="2">${esc(r.title)}</textarea><textarea class="ed" rows="6" placeholder="Resumo (pode ficar vazio para manchete)">${esc(r.description)}</textarea>
<textarea class="eb" rows="5" placeholder="Texto estendido (opcional): abre em Ler registro completo">${esc(r.body||"")}</textarea>
<div class="f"><input class="elu" type="url" placeholder="Link do botão (https://...)" value="${esc(r.link_url||"")}"></div>
<div class="f"><input class="ell" maxlength="40" placeholder="Texto do botão (ex.: Ler matéria)" value="${esc(r.link_label||"")}"></div>
<div class="f"><select class="eca"><option value="none" ${r.click_action=="none"?"selected":""}>Ao clicar no registro: nada</option><option value="link" ${r.click_action=="link"?"selected":""}>Ao clicar: abrir o link</option><option value="page" ${r.click_action=="page"?"selected":""}>Ao clicar: abrir a versão completa</option></select></div>
<div class="f"><select class="euf"><option value="">Estado: não informado</option>${Object.entries(UFN).map(([k,v])=>`<option value="${k}" ${r.uf==k?"selected":""}>${v}</option>`).join("")}</select></div>
<div class="f"><input class="eou" type="url" placeholder="Fonte oficial (https://...)" value="${esc(r.official_url||"")}"></div>
<textarea class="eon" rows="3" maxlength="400" placeholder="O que a decisão oficial afirma (aparece com o link da fonte)">${esc(r.official_note||"")}</textarea>
<div class="w2">${r.public_fact?"Fato público":"Envolve pessoas privadas"}${r.evidence_url?` · <a href="${esc(r.evidence_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--lime)">prova</a>`:""}${r.reject_reason?` · motivo: ${esc(r.reject_reason)}`:""}</div>
<div class="acts"><button data-a="save">Salvar edição</button>${B[AS].map(a=>`<button data-a="${a}">${BL[a]}</button>`).join("")}</div></div>`).join(""):'<div class="item"><p>Nada nesta fila.</p></div>';$("aq").querySelectorAll(".f select").forEach(mkSel)}
document.addEventListener("click",async e=>{const tb=e.target.closest("[data-tab]");if(tb){AS=tb.dataset.tab;document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b==tb));loadQ();return}
const b=e.target.closest("[data-a]");if(!b)return;const card=b.closest("[data-id]"),a=b.dataset.a;const lu=card.querySelector(".elu").value.trim();if(lu&&!/^https:\/\//.test(lu)){alert("O link precisa começar com https://");return}
const up={title:card.querySelector(".et").value.trim(),description:card.querySelector(".ed").value.trim(),body:card.querySelector(".eb").value.trim()||null,link_url:lu||null,link_label:card.querySelector(".ell").value.trim()||null,click_action:card.querySelector(".eca").value,uf:card.querySelector(".euf").value||null,official_url:card.querySelector(".eou").value.trim()||null,official_note:card.querySelector(".eon").value.trim()||null};
if(up.click_action=="link"&&!up.link_url){alert("Informe o link para usar essa ação.");return}
if(up.click_action=="page"&&!up.body){alert("Escreva o texto estendido para usar essa ação.");return}
if(up.official_url&&!/^https:\/\//.test(up.official_url)){alert("A fonte oficial precisa começar com https://");return}
if(up.official_note&&!up.official_url){alert("Para exibir a decisão, informe o link da fonte oficial.");return}
if(a!="save"){up.status=a;if(a=="rejected"){const m=prompt("Motivo interno da rejeição:");if(!m)return;up.reject_reason=m}}
const{error}=await SB.from("reports").update(up).eq("id",card.dataset.id);if(error){alert(error.message);return}loadQ()});

/* ---------- telas de acesso ---------- */
const app=$("app");
const view=h=>{app.innerHTML=h};
const msg=(t,ok)=>{const m=$("m");if(m){m.textContent=t||"";m.style.color=ok?"var(--lime)":""}};
function pwCheck(p,email){if(p.length<CFG.minPass)return"Use pelo menos "+CFG.minPass+" caracteres.";if(/^(.)\1+$/.test(p))return"Escolha uma senha menos previsível.";
const l=(email||"").split("@")[0].toLowerCase();if(l.length>=4&&p.toLowerCase().includes(l))return"A senha não pode conter o seu e-mail.";
if(!(/[a-z]/.test(p)&&/[A-Z0-9]/.test(p)))return"Misture letras minúsculas com maiúsculas ou números.";return""}
const head=(lab,h,p)=>`<div class="lab">${lab}</div><h2>${h}</h2>${p?`<p class="mut" style="margin-top:12px">${p}</p>`:""}`;
function showLogin(note){
view(`<section class="narrow">${head("Área restrita","Entrar.","Acesso apenas para a equipe. Depois da senha, pedimos o código do autenticador.")}
${note?`<div class="box"><p>${esc(note)}</p></div>`:""}
<label class="fl" for="em">E-mail</label><div class="f"><input id="em" type="email" autocomplete="username" autocapitalize="off" spellcheck="false"></div>
<label class="fl" for="pw">Senha</label><div class="f"><input id="pw" type="password" autocomplete="current-password"></div>
<button class="btn" id="go" type="button" style="margin-top:24px">Entrar</button>
<button class="btn o" id="rs" type="button" style="margin-top:10px">Primeiro acesso ou esqueci a senha</button>
<p class="sm" id="m" style="margin-top:12px" aria-live="polite"></p></section>`);
$("go").onclick=async()=>{const e=$("em").value.trim(),p=$("pw").value;if(!e||!p){msg("Informe e-mail e senha.");return}
$("go").disabled=true;msg("Verificando…",true);await wait(Math.min(FAILS,6)*1200);
const{error}=await SB.auth.signInWithPassword({email:e,password:p});$("go").disabled=false;
if(error){FAILS++;msg("E-mail ou senha incorretos, ou acesso bloqueado por alguns minutos.");return}
FAILS=0;boot()};
$("pw").addEventListener("keydown",ev=>{if(ev.key==="Enter")$("go").click()});$("rs").onclick=showReset}
function showReset(){
view(`<section class="narrow">${head("Área restrita","Definir senha.","Informe o e-mail da sua conta de equipe. Se ele tiver acesso, enviamos um link para criar uma senha nova.")}
<label class="fl" for="em">E-mail</label><div class="f"><input id="em" type="email" autocomplete="username" autocapitalize="off"></div>
<button class="btn" id="go" type="button" style="margin-top:24px">Enviar link</button>
<button class="btn o" id="bk" type="button" style="margin-top:10px">Voltar</button><p class="sm" id="m" style="margin-top:12px" aria-live="polite"></p></section>`);
$("bk").onclick=()=>showLogin();
$("go").onclick=async()=>{const e=$("em").value.trim();if(!/^\S+@\S+\.\S+$/.test(e)){msg("Digite um e-mail válido.");return}
$("go").disabled=true;await SB.auth.resetPasswordForEmail(e,{redirectTo:location.origin+"/"});$("go").disabled=false;
msg("Se este e-mail tiver acesso, o link foi enviado. Confira também o spam.",true)}}
async function showChallenge(){
view(`<section class="narrow">${head("Verificação em duas etapas","Código do autenticador.","Abra o aplicativo autenticador e digite os 6 números.")}
<label class="fl" for="cd">Código</label><div class="f"><input id="cd" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000"></div>
<button class="btn" id="go" type="button" style="margin-top:24px">Confirmar</button><button class="btn o" id="so" type="button" style="margin-top:10px">Sair</button>
<p class="sm" id="m" style="margin-top:12px" aria-live="polite"></p></section>`);
$("so").onclick=async()=>{await SB.auth.signOut();showLogin()};
$("cd").addEventListener("keydown",ev=>{if(ev.key==="Enter")$("go").click()});
$("go").onclick=async()=>{const code=$("cd").value.replace(/\s/g,"");if(!/^\d{6}$/.test(code)){msg("Digite os 6 números do aplicativo.");return}
const{data:fs}=await SB.auth.mfa.listFactors();const f=(fs&&fs.totp||[])[0];if(!f){boot();return}
$("go").disabled=true;const{error}=await SB.auth.mfa.challengeAndVerify({factorId:f.id,code});$("go").disabled=false;
if(error){FAILS++;await wait(Math.min(FAILS,5)*1000);msg("Código incorreto ou expirado.");return}FAILS=0;boot()}}
async function showEnroll(){
const{data:fs}=await SB.auth.mfa.listFactors();for(const f of(fs&&fs.all||[]))if(f.status==="unverified")await SB.auth.mfa.unenroll({factorId:f.id});
const{data,error}=await SB.auth.mfa.enroll({factorType:"totp",friendlyName:"Admin "+TD()});
if(error||!data){view(`<section class="narrow">${head("Verificação em duas etapas","Não foi possível iniciar.","Confirme no painel do Supabase (Authentication, MFA) se o TOTP está ativado.")}<button class="btn o" id="so" type="button" style="margin-top:20px">Sair</button></section>`);$("so").onclick=async()=>{await SB.auth.signOut();showLogin()};return}
view(`<section class="narrow">${head("Verificação em duas etapas","Configurar autenticador.","Obrigatório para a equipe. Leia o QR Code com um aplicativo autenticador (Google Authenticator, 1Password, Authy…) e digite o código que ele mostrar.")}
<div class="qrw"><img id="qr" alt="QR Code do autenticador" width="190" height="190"></div>
<p class="sm" style="margin-top:12px">Sem câmera? Digite esta chave no aplicativo:</p><p class="mono" id="sec" style="word-break:break-all;margin-top:6px"></p>
<label class="fl" for="cd">Código de 6 números</label><div class="f"><input id="cd" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000"></div>
<button class="btn" id="go" type="button" style="margin-top:24px">Ativar</button><button class="btn o" id="so" type="button" style="margin-top:10px">Sair</button>
<p class="sm" id="m" style="margin-top:12px" aria-live="polite"></p></section>`);
$("qr").src=data.totp.qr_code;$("sec").textContent=data.totp.secret;
$("so").onclick=async()=>{await SB.auth.signOut();showLogin()};
$("go").onclick=async()=>{const code=$("cd").value.replace(/\s/g,"");if(!/^\d{6}$/.test(code)){msg("Digite os 6 números do aplicativo.");return}
$("go").disabled=true;const{error:e2}=await SB.auth.mfa.challengeAndVerify({factorId:data.id,code});$("go").disabled=false;
if(e2){msg("Código incorreto. Confira o relógio do celular e tente de novo.");return}boot()}}
function showChangePw(forced){
view(`<section class="narrow">${head("Segurança",forced?"Troque a senha temporária.":"Nova senha.","Use pelo menos "+CFG.minPass+" caracteres, sem o seu e-mail, com letras e números.")}
<label class="fl" for="p1">Nova senha</label><div class="f"><input id="p1" type="password" autocomplete="new-password"></div>
<label class="fl" for="p2">Repita a nova senha</label><div class="f"><input id="p2" type="password" autocomplete="new-password"></div>
<button class="btn" id="go" type="button" style="margin-top:24px">Salvar senha</button><p class="sm" id="m" style="margin-top:12px" aria-live="polite"></p></section>`);
$("go").onclick=async()=>{const a=$("p1").value,b=$("p2").value,em=(await SB.auth.getUser()).data.user.email;
if(a!==b){msg("As senhas não conferem.");return}const bad=pwCheck(a,em);if(bad){msg(bad);return}
$("go").disabled=true;const{error}=await SB.auth.updateUser({password:a});
if(error){$("go").disabled=false;msg(/aal2/i.test(error.message)?"Confirme o código do autenticador e tente de novo.":"Não foi possível salvar. Tente outra senha.");return}
if(forced){await SB.functions.invoke("admin-users",{body:{action:"password-changed"}});await SB.auth.refreshSession()}
RECOVERY=false;history.replaceState(null,"",location.pathname);boot()}}
async function denied(){await SB.auth.signOut();showLogin("Esta conta não tem acesso à moderação.")}
async function boot(){
const{data:{session}}=await SB.auth.getSession();if(!session)return showLogin();
const u=session.user;
const{data:me}=await SB.from("admins").select("role").eq("user_id",u.id).maybeSingle();if(!me)return denied();
const{data:aal}=await SB.auth.mfa.getAuthenticatorAssuranceLevel();
if(!aal||aal.currentLevel!=="aal2")return aal&&aal.nextLevel==="aal2"?showChallenge():showEnroll();
const must=!!(u.app_metadata&&u.app_metadata.must_change_password);
if(must||RECOVERY)return showChangePw(must);
ME={id:u.id,email:u.email,role:me.role};startShell()}
function resetIdle(){clearTimeout(IDLE);IDLE=setTimeout(async()=>{await SB.auth.signOut();ME=null;$("who").textContent="";$("out").hidden=true;showLogin("Sessão encerrada por inatividade.")},CFG.idleMin*60000)}
function startShell(){
$("who").textContent=ME.email+" · "+(ME.role==="owner"?"proprietário":"moderador");$("out").hidden=false;
if(!IDLEON){IDLEON=true;["click","keydown","touchstart","mousemove"].forEach(ev=>addEventListener(ev,()=>{if(ME)resetIdle()},{passive:true}))}
resetIdle();
view(`<section style="padding-top:24px"><div class="tabs" id="tabs"></div><div id="aq" style="border:1px solid var(--line);margin-top:14px"></div></section>`);drawTabs();loadQ()}
function drawTabs(){const T=[["dash","Painel"],["pending","Pendentes"],["approved","Registradas"],["verified","Verificadas"],["resolved","Resolvidas"],["rejected","Rejeitadas"],["new","+ Novo"],["msgs","Mensagens"]];
if(ME.role==="owner")T.push(["feeds","Fontes"],["live","Ao vivo"],["team","Equipe"],["audit","Auditoria"]);T.push(["sec","Segurança"]);
$("tabs").innerHTML=T.map(([k,l])=>`<button data-tab="${k}" class="${k==AS?"on":""}">${l}</button>`).join("")}

/* ---------- telas novas do painel ---------- */
async function renderDash(){$("aq").onclick=null;
const st=["pending","approved","verified","resolved","rejected"],L={pending:"Pendentes",approved:"Registradas",verified:"Verificadas",resolved:"Resolvidas",rejected:"Rejeitadas"};
const [rs,m,au]=await Promise.all([Promise.all(st.map(s=>SB.from("reports").select("id",{count:"exact",head:true}).eq("status",s))),
SB.from("contact_messages").select("id",{count:"exact",head:true}).eq("handled",false),SB.from("audit_log").select("*").order("at",{ascending:false}).limit(8)]);
const n={};st.forEach((s,i)=>n[s]=rs[i].count||0);const pub=n.approved+n.verified+n.resolved,mx=Math.max(1,...st.map(s=>n[s]));
$("aq").innerHTML=`<div class="stats" style="border:0;border-bottom:1px solid var(--line)"><div><div class="num">${n.pending}</div><div class="lab">Aguardando análise</div></div><div><div class="num">${m.count||0}</div><div class="lab">Mensagens novas</div></div><div><div class="num">${pub}</div><div class="lab">Publicados</div></div></div>
<div class="bars" style="border:0;margin:0;max-width:none">${st.map(s=>`<div class="bar in"><div class="t"><span>${L[s]}</span><b>${n[s]}</b></div><i><s style="width:${n[s]/mx*100}%"></s></i></div>`).join("")}</div>
<div class="item"><div class="lab">Últimas ações de moderação</div>${(au.data||[]).length?(au.data||[]).map(a=>`<div class="w2" style="padding:6px 0">${new Date(a.at).toLocaleString("pt-BR")} · ${esc(a.action)}</div>`).join(""):'<p class="sm">Nenhuma ação ainda.</p>'}</div>`}
function pwBox(r){return`<div class="box" style="margin:0 0 1px;border-color:var(--lime)"><h3>Senha temporária de ${esc(r.email)}</h3><p style="color:#fff;font:500 18px 'JetBrains Mono',monospace;word-break:break-all;margin:8px 0">${esc(r.tempPassword)}</p><p class="sm">Mostrada só agora. Entregue por um canal seguro. No primeiro acesso a pessoa configura o autenticador e troca a senha.</p></div>`}
async function teamCall(body){const{data,error}=await SB.functions.invoke("admin-users",{body});if(error||(data&&data.error)){let m="";if(error){try{m=(await error.context.json()).error}catch(_){}}return{err:(data&&data.error)||m||"Não foi possível concluir. Confira se a função admin-users foi publicada."}}return{data}}
async function renderTeam(box){if(!box)$("aq").onclick=null;const r=await teamCall({action:"list"});
if(r.err){$("aq").innerHTML='<div class="item"><p>'+esc(r.err)+'</p></div>';return}
const rows=r.data.admins.map(a=>`<div class="item"><div class="m"><span>${a.role==="owner"?"Proprietário":"Moderador"}${a.must_change?" · senha temporária":""}</span><b class="${a.mfa?"":"pii"}">${a.mfa?"2 etapas ativas":"2 etapas pendentes"}</b></div><h3>${esc(a.email)}</h3><div class="w2">Último acesso: ${a.last?new Date(a.last).toLocaleString("pt-BR"):"nunca"}</div>${a.id===ME.id?"":`<div class="acts"><button data-t="reset" data-id="${a.id}">Gerar nova senha temporária</button><button data-t="role" data-id="${a.id}" data-r="${a.role==="owner"?"moderator":"owner"}">Tornar ${a.role==="owner"?"moderador":"proprietário"}</button><button data-t="del" data-id="${a.id}">Remover acesso</button></div>`}</div>`).join("");
$("aq").innerHTML=`<div id="pb"></div><div class="item"><div class="lab">Novo acesso</div><label class="fl" style="margin-top:0" for="te">E-mail</label><div class="f"><input id="te" type="email" autocapitalize="off" placeholder="pessoa@exemplo.com"></div>
<label class="fl" for="tr">Papel</label><div class="f"><select id="tr"><option value="moderator">Moderador</option><option value="owner">Proprietário</option></select></div>
<button class="btn" id="tb" type="button" style="margin-top:20px">Criar acesso com senha temporária</button><p class="sm" id="tm" style="margin-top:10px" aria-live="polite"></p></div>${rows}`;
$("aq").querySelectorAll(".f select").forEach(mkSel);
$("tb").onclick=async()=>{const e=$("te").value.trim();if(!/^\S+@\S+\.\S+$/.test(e)){$("tm").textContent="Digite um e-mail válido.";return}
$("tb").disabled=true;const x=await teamCall({action:"create",email:e,role:$("tr").value});$("tb").disabled=false;
if(x.err){$("tm").textContent=x.err;return}await renderTeam(true);$("pb").innerHTML=pwBox(x.data)};
$("aq").onclick=async ev=>{const b=ev.target.closest("[data-t]");if(!b)return;const id=b.dataset.id;
if(b.dataset.t==="reset"){if(!confirm("Gerar nova senha temporária? A senha e o autenticador atuais deixam de valer."))return;const x=await teamCall({action:"reset",id});if(x.err){alert(x.err);return}await renderTeam(true);$("pb").innerHTML=pwBox(x.data);return}
if(b.dataset.t==="role"){const x=await teamCall({action:"setrole",id,role:b.dataset.r});if(x.err){alert(x.err);return}renderTeam();return}
if(b.dataset.t==="del"){if(!confirm("Remover o acesso de moderação desta pessoa?"))return;const x=await teamCall({action:"remove",id});if(x.err){alert(x.err);return}renderTeam()}}}
async function renderAudit(){$("aq").onclick=null;
const [a,s,t]=await Promise.all([SB.from("audit_log").select("*").order("at",{ascending:false}).limit(100),SB.from("security_log").select("*").order("at",{ascending:false}).limit(100),teamCall({action:"list"})]);
const em={};((t.data&&t.data.admins)||[]).forEach(x=>em[x.id]=x.email);
const L=[...(a.data||[]).map(x=>({at:x.at,who:em[x.admin_id]||String(x.admin_id).slice(0,8),what:"Registro "+String(x.report_id).slice(0,8)+": "+x.action})),...(s.data||[]).map(x=>({at:x.at,who:x.actor_email||"?",what:"Equipe: "+x.action+(x.target_email?" · "+x.target_email:"")}))].sort((p,q)=>new Date(q.at)-new Date(p.at)).slice(0,150);
$("aq").innerHTML=L.length?L.map(x=>`<div class="item"><div class="m"><span>${new Date(x.at).toLocaleString("pt-BR")}</span><b>${esc(x.who)}</b></div><p style="margin-top:6px">${esc(x.what)}</p></div>`).join(""):'<div class="item empty"><p>Nenhum evento.</p></div>'}
async function renderSec(){$("aq").onclick=null;const{data:fs}=await SB.auth.mfa.listFactors();const n=(fs&&fs.totp||[]).length;
$("aq").innerHTML=`<div class="item"><div class="m"><span>${esc(ME.email)}</span><b>${ME.role==="owner"?"Proprietário":"Moderador"}</b></div><h3>Autenticador</h3><p>${n?"Ativo ("+n+" aparelho"+(n>1?"s":"")+").":"Não configurado."}</p></div>
<div class="item"><h3>Trocar senha</h3><div class="f"><input id="p1" type="password" autocomplete="new-password" placeholder="Nova senha"></div><div class="f"><input id="p2" type="password" autocomplete="new-password" placeholder="Repita a nova senha"></div>
<button class="btn" id="sp" type="button" style="margin-top:18px">Trocar senha</button><p class="sm" id="sm" style="margin-top:10px" aria-live="polite"></p></div>
<div class="item"><h3>Sessões</h3><p>Encerra o acesso em todos os aparelhos, inclusive este.</p><button class="btn o" id="sg" type="button" style="margin-top:14px">Sair de todos os aparelhos</button></div>`;
$("sp").onclick=async()=>{const a=$("p1").value,b=$("p2").value,m=$("sm");if(a!==b){m.textContent="As senhas não conferem.";return}const bad=pwCheck(a,ME.email);if(bad){m.textContent=bad;return}
const{error}=await SB.auth.updateUser({password:a});m.textContent=error?"Não foi possível trocar a senha.":"Senha trocada.";if(!error){$("p1").value=$("p2").value=""}};
$("sg").onclick=async()=>{await SB.auth.signOut({scope:"global"});location.reload()}}
$("out").onclick=async()=>{await SB.auth.signOut();location.reload()};
SB.auth.onAuthStateChange(ev=>{if(ev==="PASSWORD_RECOVERY"){RECOVERY=true;setTimeout(boot,0)}});
boot();
