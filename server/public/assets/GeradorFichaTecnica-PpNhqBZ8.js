import{a as e}from"./rolldown-runtime-COnpUsM8.js";import{r as t,t as n}from"./vendor-react-Bmpaw9Cg.js";import{$ as r,F as i,O as a,Tt as o,r as s,u as c,y as l}from"./vendor-icons-DhJ6C8BI.js";var u=e(t(),1),d=n();function f(e,t=``,n=`GERAL`){let r=e.split(/\r?\n/),i=0,a=0,o=0,s=1/0,c=-1/0,l=1/0,u=-1/0,d=1/0,f=-1/0,p=!1,m=3e3,h=0,g=0,_=0,v=new Set,y=new Set,b=/([XYZFS])([-+]?\d*\.?\d+)/gi,x=/\bG0?([0123])\b/i;for(let e=0;e<r.length;e++){let t=r[e].trim();if(!t||t.startsWith(`(`)||t.startsWith(`;`)||t.startsWith(`%`))continue;let n=t.match(x);n&&(h=parseInt(n[1],10)===0?0:1);let S=i,C=a,w=o,T=!1;b.lastIndex=0;let E;for(;(E=b.exec(t))!==null;){let e=E[1].toUpperCase(),t=parseFloat(E[2]);isNaN(t)||(e===`X`?(S=t,T=!0):e===`Y`?(C=t,T=!0):e===`Z`?(w=t,T=!0):e===`F`&&t>0?(m=t,v.add(Math.round(t))):e===`S`&&t>0&&y.add(Math.round(t)))}if(T){let e=S-i,t=C-a,n=w-o,r=Math.sqrt(e*e+t*t+n*n);r>0&&(h===0?g+=r/8e3:(g+=r/(m>0?m:2500)*1.12,_+=r,(S!==i||C!==a)&&(p=!0,S<s&&(s=S),S>c&&(c=S),C<l&&(l=C),C>u&&(u=C)),w<d&&(d=w),w>f&&(f=w))),i=S,a=C,o=w}}return{fileName:t,groupName:n,widthMm:p?Math.round(c-s):0,heightMm:p?Math.round(u-l):0,depthMm:d!==1/0&&f!==-1/0?Math.round(Math.abs(f-d)):0,cutMeters:Math.round(_/1e3),estimatedMinutes:Math.max(.5,parseFloat(g.toFixed(1))),feeds:Array.from(v).sort((e,t)=>t-e).slice(0,2),spindles:Array.from(y).sort((e,t)=>t-e).slice(0,1)}}function p(e){let t=Math.round(Number(e)||0);if(t<60)return`${t}min`;let n=Math.floor(t/60),r=t%60;return r>0?`${n}h ${String(r).padStart(2,`0`)}min`:`${n}h 00min`}function m(e){if(!e)return``;try{return new Date(e).toLocaleDateString(`pt-BR`,{day:`2-digit`,month:`2-digit`,timeZone:`America/Sao_Paulo`})}catch{return new Date(e).toLocaleDateString(`pt-BR`,{day:`2-digit`,month:`2-digit`})}}function h(e){if(!e)return``;try{return new Date(e).toLocaleTimeString(`pt-BR`,{hour:`2-digit`,minute:`2-digit`,timeZone:`America/Sao_Paulo`})}catch{return new Date(e).toLocaleTimeString(`pt-BR`,{hour:`2-digit`,minute:`2-digit`})}}function g(e){return String(e||``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function _({jobs:e=[]}){let[t,n]=(0,u.useState)(`lote`),_=(0,u.useMemo)(()=>{let t=new Map;for(let n of e){let e=(n.folder||``).trim();!e||e.toLowerCase()===`desconhecido`||(t.has(e)||t.set(e,{folder:e,count:0,lastStart:n.start_time,sampleFile:n.file_name||``}),t.get(e).count+=1)}return Array.from(t.values()).sort((e,t)=>new Date(t.lastStart)-new Date(e.lastStart))},[e]),[v,y]=(0,u.useState)(``),[b,x]=(0,u.useState)(``),[S,C]=(0,u.useState)(50),[w,T]=(0,u.useState)(15),[E,D]=(0,u.useState)(2),[O,k]=(0,u.useState)(7),[A,j]=(0,u.useState)(`08:00`),[M,N]=(0,u.useState)(``),[P,F]=(0,u.useState)(`ORDEM DE PRODUÇÃO · FICHA TÉCNICA CNC`),[I,L]=(0,u.useState)(`Controle Sequencial de Chapas e Tempo Estimado`),[R,z]=(0,u.useState)(`Fresa Topo Ø6mm (e6mm)`),[B,V]=(0,u.useState)(`MDF 9mm (2750×1850mm) · F3200 · S18000`),[H,U]=(0,u.useState)(`2750×1850mm · MDF`),[W,G]=(0,u.useState)(``),[K,q]=(0,u.useState)([]),[ee,J]=(0,u.useState)(!1),[Y,te]=(0,u.useState)({}),ne=t=>{if(y(t),!t)return;x(``),N(``),F(t.toUpperCase()),L(`Pasta / Projeto: ${t}`);let n=e.filter(e=>(e.folder||``).trim()===t)[0];if(n&&n.file_name){let e=n.file_name.toLowerCase();e.includes(`b12mm`)?z(`Ball Nose Ø12mm (b12mm)`):e.includes(`e6mm`)?z(`Fresa Topo Ø6mm (e6mm)`):e.includes(`e4mm`)&&z(`Fresa Topo Ø4mm (e4mm)`),e.includes(`mdf9mm`)||e.includes(`mdf 9mm`)?(U(`2750×1850mm · MDF 9mm`),V(`MDF 9mm · F3200 · S15000`)):e.includes(`pvc100mm`)||e.includes(`isopor`)?(U(`Bloco Isopor Esp. 100mm`),V(`Esp. 100mm · F6000 · S12000`)):e.includes(`compensado 10mm`)&&(U(`2750×1850mm · Comp. 10mm`),V(`Compensado 10mm · F3000 · S15000`))}},re=async e=>{let t=Array.from(e.target.files||[]).filter(e=>/\.(txt|nc|tap|gcode|cnc)$/i.test(e.name)&&!e.name.toLowerCase().startsWith(`checklist`));if(t.length!==0){J(!0);try{let e=[];for(let n of t){let t=await n.text(),r=`ARQUIVOS SELECIONADOS`;if(n.webkitRelativePath){let e=n.webkitRelativePath.split(`/`).filter(Boolean);e.length>=2&&(r=e.slice(0,-1).join(` \\ `).toUpperCase())}e.push(f(t,n.name,r))}e.sort((e,t)=>e.groupName.localeCompare(t.groupName)||e.fileName.localeCompare(t.fileName,void 0,{numeric:!0})),q(e),n(`arquivos`);let r=e.flatMap(e=>e.feeds),i=e.flatMap(e=>e.spindles);(r.length>0||i.length>0)&&V([r.length>0?`F${Math.max(...r)}`:``,i.length>0?`S${Math.max(...i)}`:``].filter(Boolean).join(` · `))}finally{J(!1)}}},X=(0,u.useMemo)(()=>e.filter(e=>{if(v&&(e.folder||``).trim()!==v)return!1;if(b.trim()){let t=b.trim().toLowerCase(),n=(e.file_name||``).toLowerCase().includes(t),r=(e.folder||``).toLowerCase().includes(t);if(!n&&!r)return!1}return!(M&&new Date(e.start_time).toLocaleDateString(`en-CA`,{timeZone:`America/Sao_Paulo`})<M)}).sort((e,t)=>new Date(e.start_time)-new Date(t.start_time)),[e,v,b,M]),Z=(0,u.useMemo)(()=>{let e=Number(w)||0,t=[],n=[];for(let r of X){let i=!r.end_time,a=Number(r.duration_minutes)||0;if(i||a>=e){let e=Math.max(1,parseInt(r.quantity,10)||1);for(let n=0;n<e;n++)t.push({...r,unitDuration:e>1?a/e:a})}else a>=1&&n.push(r)}let r=Math.max(1,parseInt(S,10)||50),i=t.filter(e=>!!e.end_time).length,a=t.filter(e=>!e.end_time).length,o=t.filter(e=>e.end_time&&e.unitDuration>0).map(e=>e.unitDuration),s=o.length>0?o.reduce((e,t)=>e+t,0)/o.length:35,c={};t.filter(e=>e.end_time&&e.router_name).forEach(e=>{c[e.router_name]||(c[e.router_name]=[]),c[e.router_name].push(e.unitDuration)});let l=Object.entries(c).map(([e,t])=>({name:e,avgCut:t.reduce((e,t)=>e+t,0)/t.length,count:t.length})),u=Math.max(0,Number(O)||0),d=s+u,f=Math.max(1,parseInt(E,10)||2),p=0;for(let e=t.length+1;e<=r;e++)Y[`lote-${e}`]&&p++;let g=Math.min(r,i+p),_=Math.max(0,r-g-a),v=60/d*f;f===2&&l.length>=2&&(v=60/(l[0].avgCut+u)+60/(l[1].avgCut+u));let y=_>0?_/v:0,b=Math.round(y*60),x=Math.round(_*d),C=`Concluído`;if(_>0&&A){let[e,t]=A.split(`:`).map(Number);if(!isNaN(e)&&!isNaN(t)){let n=new Date;n.setHours(e,t,0,0);let r=new Date(n.getTime()+b*6e4);C=`${r.toLocaleTimeString(`pt-BR`,{hour:`2-digit`,minute:`2-digit`})}${r.getDate()===n.getDate()?``:` (+1 dia)`}`}}let T=[],D=Math.max(r,t.length);for(let e=1;e<=D;e++){let n=t[e-1],i=`lote-${e}`;if(n){let t=!n.end_time;T.push({key:i,num:e,label:`CHAPA ${String(e).padStart(2,`0`)} / ${String(r).padStart(2,`0`)}`,fileName:n.file_name||` corte.txt`,dimText:H,durText:t?`Em corte...`:`${n.unitDuration.toFixed(1).replace(`.`,`,`)} min`,status:t?`running`:`done`,execText:t?`${n.router_name||`Router`} · Início ${h(n.start_time)} · Fim: ___:___`:`${n.router_name||`Router`} · ${m(n.start_time)} · ${h(n.start_time)} às ${h(n.end_time)}`,routerName:n.router_name||`Router`,timeRange:t?`Início ${h(n.start_time)} · Fim: ___:___`:`${m(n.start_time)} · ${h(n.start_time)} às ${h(n.end_time)}`,operator:n.operator_name||`—`})}else{let n=!!Y[i],a=l.length>=2?l[(e-t.length-1)%l.length]:null;T.push({key:i,num:e,label:`CHAPA ${String(e).padStart(2,`0`)} / ${String(r).padStart(2,`0`)}`,fileName:t[t.length-1]?.file_name||`chapa_producao.txt`,dimText:H,durText:a?`${a.name.replace(`Router `,`R. `)} (~${Math.round(a.avgCut)}m)`:`~${Math.round(s)} min`,status:n?`done`:`pending`,routerName:``,timeRange:``,operator:``})}}return{totalGoal:r,completedCount:g,runningCount:a,pendingSheets:_,avgCutMin:s,routerStats:l,sheetsPerHour:v,estRemainingMinMulti:b,estRemainingMinSingle:x,projectedEndTimeStr:C,partialJobs:n,rows:T}},[X,w,S,O,E,A,H,Y]),Q=(0,u.useMemo)(()=>{let e=K;if(e.length===0){let t=new Map;for(let e of X){if(!e.file_name)continue;let n=e.file_name.toLowerCase();t.has(n)||t.set(n,{fileName:e.file_name,groupName:(e.folder||`ARQUIVOS DO PROJETO`).toUpperCase(),widthMm:e.max_x?Math.round(e.max_x):0,heightMm:e.max_y?Math.round(e.max_y):0,cutMeters:0,estimatedMinutes:Number(e.estimated_minutes)||Number(e.duration_minutes)||30})}e=Array.from(t.values())}let t=e.map((e,t)=>{let n=`file-${t}-${e.fileName}`,r=X.filter(t=>(t.file_name||``).toLowerCase()===e.fileName.toLowerCase()),i=r.find(e=>!e.end_time),a=r.filter(e=>!!e.end_time),o=a[a.length-1],s=!!Y[n],c=`pending`;i?c=`running`:(o||s)&&(c=`done`);let l=[];e.widthMm>0&&e.heightMm>0&&l.push(`${e.widthMm}×${e.heightMm}mm`),e.cutMeters>0&&l.push(`${e.cutMeters}m`);let u=l.length>0?l.join(` · `):H,d=i||o;return{...e,key:n,status:c,dimText:u,estText:p(e.estimatedMinutes),routerName:d?.router_name||``,timeRange:i?`Início ${h(i.start_time)} · Fim: ___:___`:o?`${m(o.start_time)} · ${h(o.start_time)} às ${h(o.end_time)} (${Math.round(o.duration_minutes||0)}m)`:``,operator:d?.operator_name||``}}),n=t.reduce((e,t)=>e+(t.estimatedMinutes||0),0),r=t.filter(e=>e.status===`done`),i=t.filter(e=>e.status===`running`),a=t.filter(e=>e.status===`pending`),o=a.reduce((e,t)=>e+(t.estimatedMinutes||0)+(Number(O)||0),0),s=Math.round(o/Math.max(1,parseInt(E,10)||2)),c=`Concluído`;if(a.length>0&&A){let[e,t]=A.split(`:`).map(Number);if(!isNaN(e)&&!isNaN(t)){let n=new Date;n.setHours(e,t,0,0);let r=new Date(n.getTime()+s*6e4);c=`${r.toLocaleTimeString(`pt-BR`,{hour:`2-digit`,minute:`2-digit`})}${r.getDate()===n.getDate()?``:` (+1 dia)`}`}}let l={};return t.forEach(e=>{l[e.groupName]||(l[e.groupName]=[]),l[e.groupName].push(e)}),{items:t,groups:l,totalEstMin:n,doneCount:r.length,runCount:i.length,pendCount:a.length,pendMinSingle:o,pendMinMulti:s,projectedEndTimeStr:c}},[K,X,H,Y,O,E,A]),$=e=>{te(t=>({...t,[e]:!t[e]}))};return(0,d.jsxs)(`div`,{className:`space-y-6 animate-in fade-in duration-500`,children:[(0,d.jsxs)(`div`,{className:`flex flex-col md:flex-row md:items-center justify-between gap-4`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`p`,{className:`text-xs font-black uppercase tracking-[0.3em] text-orange-400 mb-1`,children:`Engenharia & Chão de Fábrica`}),(0,d.jsxs)(`h2`,{className:`text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3`,children:[(0,d.jsx)(o,{className:`text-orange-400`,size:28}),`Gerador de Ficha Técnica & Checklist PDF`]}),(0,d.jsx)(`p`,{className:`text-xs text-text-muted mt-1`,children:`Cruza automaticamente o Histórico CNC em tempo real, simula tempos G-Code e projeta o horário de conclusão do lote para prancheta A4.`})]}),(0,d.jsxs)(`button`,{onClick:()=>{let e=new Date().toLocaleDateString(`pt-BR`)+` · `+new Date().toLocaleTimeString(`pt-BR`,{hour:`2-digit`,minute:`2-digit`}),n=Math.max(1,parseInt(E,10)||2),r=``;if(t===`lote`){let t=Math.max(1,Math.ceil(Z.rows.length/25)),i=Math.min(100,Math.round(Z.completedCount/Z.totalGoal*100));for(let a=0;a<t;a++){let o=Z.rows.slice(a*25,(a+1)*25),s=o[0]?.num||1,c=o[o.length-1]?.num||1,l=a===0,u=a===t-1,d=o.map(e=>{let t=e.status===`done`?`<span class="checkbox checked">✓</span>`:e.status===`running`?`<span class="checkbox in-prog">▶</span>`:`<span class="checkbox"></span>`,n=e.status===`done`?`<span class="badge badge-done">Concluída</span>`:e.status===`running`?`<span class="badge badge-run">Rodando</span>`:`<span class="badge badge-pend">Pendente</span>`,r=e.routerName?`<td class="log-detail"><strong>${g(e.routerName)}</strong> · ${g(e.timeRange)}</td>`:`<td class="write-line">Máq: ________ · ___:___ às ___:___</td>`,i=e.operator?`<td class="log-detail"><strong>${g(e.operator)}</strong></td>`:`<td class="write-line">_________</td>`;return`
            <tr class="${e.status===`done`?`row-done`:e.status===`running`?`row-running`:``}">
              <td class="col-check">${t}</td>
              <td class="chapa-num">${g(e.label)}</td>
              <td class="file-name">${g(e.fileName)}</td>
              <td class="dim-text">${g(e.dimText)}</td>
              <td class="time-est">${g(e.durText)}</td>
              <td>${n}</td>
              ${r}
              ${i}
            </tr>`}).join(``),f=Z.routerStats.length>0?Z.routerStats.map(e=>`<strong>${g(e.name)}</strong>: ~${Math.round(e.avgCut)}m corte (+${O}m troca)`).join(` · `):`Corte médio: ~${Math.round(Z.avgCutMin)}m (+${O}m troca)`;r+=`
          <div class="page">
            <div class="header">
              <div>
                <div class="brand-tag">${l?`Ficha Técnica de Produção CNC · Checklist de Lote Seriado`:`Continuação · Ficha Técnica & Checklist (Chapas ${s} a ${c})`}</div>
                <div class="title">${g(P)}</div>
                ${l?`<div class="subtitle">${g(I)}</div>`:``}
              </div>
              <div class="meta-box">
                <div><strong>Emissão:</strong> ${e} · <strong>Pág.:</strong> ${a+1}/${t}</div>
                <div><strong>Ferramenta:</strong> ${g(R)}</div>
                <div><strong>Parâmetros:</strong> ${g(B)}</div>
              </div>
            </div>

            ${l?`
              <div class="kpi-grid">
                <div class="kpi-card">
                  <div class="kpi-label">Meta Total do Lote</div>
                  <div class="kpi-val">${Z.totalGoal} Chapas</div>
                  <div class="kpi-sub">${g(H)}</div>
                </div>
                <div class="kpi-card done">
                  <div class="kpi-label">Concluídas</div>
                  <div class="kpi-val">${Z.completedCount} / ${Z.totalGoal} (${i}%)</div>
                  <div class="kpi-sub">${Z.runningCount>0?`${Z.runningCount} rodando agora`:`Sincronizado c/ Histórico`}</div>
                </div>
                <div class="kpi-card pending">
                  <div class="kpi-label">Saldo Restante</div>
                  <div class="kpi-val">${Z.pendingSheets} Chapas</div>
                  <div class="kpi-sub">1 Máq: ~${p(Z.estRemainingMinSingle)}</div>
                </div>
                <div class="kpi-card proj">
                  <div class="kpi-label">Projeção (${n} Routers)</div>
                  <div class="kpi-val">~${p(Z.estRemainingMinMulti)}</div>
                  <div class="kpi-sub">Término est.: ${g(Z.projectedEndTimeStr)}</div>
                </div>
              </div>

              <div class="progress-wrap">
                <div class="progress-fill" style="width: ${i}%;"></div>
              </div>

              <div class="proj-banner">
                <div>
                  <div class="proj-title">▶ Projeção Técnica de Conclusão (Meta ${Z.totalGoal} Chapas)</div>
                  <div class="proj-text">${f} · Ritmo conjunto: <strong>${Z.sheetsPerHour.toFixed(2).replace(`.`,`,`)} chapas/hora</strong>.</div>
                </div>
                <div class="proj-pill">
                  <div class="proj-pill-lbl">Em ${n} Routers Simultâneas</div>
                  <div class="proj-pill-val">~${p(Z.estRemainingMinMulti)} (${Z.pendingSheets} ch.)</div>
                  <div style="font-size:7.8px;color:#475569;">Início ${g(A)} ➔ <strong>Fim ~${g(Z.projectedEndTimeStr)}</strong></div>
                </div>
                <div class="proj-pill">
                  <div class="proj-pill-lbl">Em 1 Máquina Individual</div>
                  <div class="proj-pill-val">~${p(Z.estRemainingMinSingle)} corridas</div>
                  <div style="font-size:7.8px;color:#475569;">Ciclo médio ~${Math.round(Z.avgCutMin+Number(O||0))} min/chapa</div>
                </div>
              </div>
            `:``}

            <div class="group-header">
              <span>CONTROLE SEQUENCIAL DE USINAGEM — CHAPAS ${String(s).padStart(2,`0`)} A ${String(c).padStart(2,`0`)}</span>
              <span class="sub">Marque com ✓ cada chapa inspecionada e liberada na máquina</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th class="col-check">OK</th>
                  <th style="width:14%;">Nº Chapa</th>
                  <th style="width:22%;">Arquivo G-Code</th>
                  <th style="width:15%;">Formato / Material</th>
                  <th style="width:10%;">Duração / Est.</th>
                  <th style="width:8%;">Status</th>
                  <th style="width:19%;">Máquina / Data / Horário</th>
                  <th style="width:8%;">Operador</th>
                </tr>
              </thead>
              <tbody>${d}</tbody>
            </table>

            ${u?`
              ${W.trim()||Z.partialJobs.length>0?`
                <div class="extra-box">
                  <div>
                    <div class="extra-title">Observações Técnicas / Registros Complementares:</div>
                    <div class="extra-items">
                      ${W.trim()?`<div>${g(W)}</div>`:``}
                      ${Z.partialJobs.length>0?`<div style="color:#64748b;">Cortes parciais/testes curtos (< ${w}m) não somados como chapa completa: ${Z.partialJobs.length} registro(s).</div>`:``}
                    </div>
                  </div>
                  <div style="text-align:right;font-size:8px;color:#475569;white-space:nowrap;">
                    <strong>Legenda:</strong> ☑ Concluída · ▶ Em Máquina · ☐ A Usinar
                  </div>
                </div>
              `:``}
              <div class="footer-sigs">
                <div class="sig-block">Assinatura Operador (Turno Dia)</div>
                <div class="sig-block">Assinatura Operador (Turno Noite)</div>
                <div class="sig-block">Conferência Final / Encarregado</div>
              </div>
            `:``}
          </div>`}}else{let t=Object.entries(Q.groups).map(([e,t],n)=>{let r=t.reduce((e,t)=>e+(t.estimatedMinutes||0),0),i=t.map(e=>{let t=e.status===`done`?`<span class="checkbox checked">✓</span>`:e.status===`running`?`<span class="checkbox in-prog">▶</span>`:`<span class="checkbox"></span>`,n=e.status===`done`?`<span class="badge badge-done">Concluído</span>`:e.status===`running`?`<span class="badge badge-run">Rodando</span>`:`<span class="badge badge-pend">Pendente</span>`,r=e.routerName?`<td class="log-detail"><strong>${g(e.routerName)}</strong> · ${g(e.timeRange)}</td>`:`<td class="write-line">Máq: ________ · ___:___ às ___:___</td>`,i=e.operator?`<td class="log-detail"><strong>${g(e.operator)}</strong></td>`:`<td class="write-line">_________</td>`;return`
            <tr class="${e.status===`done`?`row-done`:e.status===`running`?`row-running`:``}">
              <td class="col-check">${t}</td>
              <td class="file-name">${g(e.fileName)}</td>
              <td class="dim-text">${g(e.dimText)}</td>
              <td class="time-est">${g(e.estText)}</td>
              <td>${n}</td>
              ${r}
              ${i}
            </tr>`}).join(``);return`
          <div class="group-header" style="margin-top:8px;">
            <span>${n+1}. CONJUNTO ${g(e)}</span>
            <span class="sub">${t.length} arquivo(s) · Subtotal Estimado: ${p(r)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th class="col-check">OK</th>
                <th style="width:26%;">Arquivo G-Code</th>
                <th style="width:17%;">Dimensões / Corte</th>
                <th style="width:11%;">Tempo Est.</th>
                <th style="width:11%;">Status</th>
                <th style="width:22%;">Execução / Máquina / Horário</th>
                <th style="width:9%;">Operador</th>
              </tr>
            </thead>
            <tbody>${i}</tbody>
          </table>`}).join(``);r=`
        <div class="page">
          <div class="header">
            <div>
              <div class="brand-tag">Controle de Produção CNC · Ficha Técnica & Checklist de Usinagem</div>
              <div class="title">${g(P)}</div>
              <div class="subtitle">${g(I)}</div>
            </div>
            <div class="meta-box">
              <div><strong>Emissão:</strong> ${e}</div>
              <div><strong>Ferramenta:</strong> ${g(R)}</div>
              <div><strong>Parâmetros:</strong> ${g(B)}</div>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Tempo Total (${Q.items.length} Arq.)</div>
              <div class="kpi-val">${p(Q.totalEstMin)}</div>
              <div class="kpi-sub">~${p(Q.totalEstMin/n)} em ${n} Routers</div>
            </div>
            <div class="kpi-card done">
              <div class="kpi-label">Concluídos</div>
              <div class="kpi-val">${Q.doneCount} / ${Q.items.length}</div>
              <div class="kpi-sub">${Q.runCount>0?`${Q.runCount} em máquina agora`:`Verificado no Histórico`}</div>
            </div>
            <div class="kpi-card pending">
              <div class="kpi-label">Fila Pendente</div>
              <div class="kpi-val">${Q.pendCount} arquivos</div>
              <div class="kpi-sub">1 Máq: ~${p(Q.pendMinSingle)}</div>
            </div>
            <div class="kpi-card proj">
              <div class="kpi-label">Projeção (${n} Routers)</div>
              <div class="kpi-val">~${p(Q.pendMinMulti)}</div>
              <div class="kpi-sub">Início ${g(A)} ➔ Fim ~${g(Q.projectedEndTimeStr)}</div>
            </div>
          </div>

          ${t}

          ${W.trim()?`
            <div class="extra-box">
              <div>
                <div class="extra-title">Observações do Encarregado:</div>
                <div class="extra-items">${g(W)}</div>
              </div>
              <div style="text-align:right;font-size:8px;color:#475569;white-space:nowrap;">
                <strong>Legenda:</strong> ☑ Concluído · ▶ Em Máquina · ☐ A Usinar
              </div>
            </div>
          `:``}

          <div class="footer-sigs">
            <div class="sig-block">Assinatura Operador (Turno Dia)</div>
            <div class="sig-block">Assinatura Operador (Turno Noite)</div>
            <div class="sig-block">Conferência / Encarregado</div>
          </div>
        </div>`}let i=`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Ficha Técnica - ${g(P)}</title>
<style>
  @page { size: A4 portrait; margin: 8.5mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; background: #fff; font-size: 9.6px; line-height: 1.28; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
  .brand-tag { display: inline-block; background: #ea580c; color: #fff; font-weight: 800; font-size: 8px; letter-spacing: 1.1px; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; margin-bottom: 3px; }
  .title { font-size: 15.5px; font-weight: 900; color: #0f172a; }
  .subtitle { font-size: 9px; color: #475569; margin-top: 2px; font-weight: 600; }
  .meta-box { text-align: right; font-size: 8.6px; color: #334155; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 9px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 7px; }
  .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; background: #f8fafc; }
  .kpi-card.done { background: #ecfdf5; border-color: #6ee7b7; }
  .kpi-card.pending { background: #fff7ed; border-color: #fdba74; }
  .kpi-card.proj { background: #eff6ff; border-color: #93c5fd; }
  .kpi-label { font-size: 7.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; }
  .kpi-card.done .kpi-label { color: #047857; }
  .kpi-card.pending .kpi-label { color: #c2410c; }
  .kpi-card.proj .kpi-label { color: #1d4ed8; }
  .kpi-val { font-size: 13.5px; font-weight: 900; color: #0f172a; margin-top: 1px; }
  .kpi-sub { font-size: 8px; color: #475569; margin-top: 1px; }
  .progress-wrap { margin: 4px 0 7px 0; background: #e2e8f0; height: 7px; border-radius: 99px; overflow: hidden; }
  .progress-fill { background: linear-gradient(90deg, #16a34a, #22c55e); height: 100%; }
  .proj-banner { background: #f0f9ff; border: 1.5px solid #7dd3fc; border-left: 5px solid #0284c7; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; display: grid; grid-template-columns: 1.25fr 1fr 1fr; gap: 10px; align-items: center; }
  .proj-title { font-size: 8.3px; font-weight: 900; text-transform: uppercase; color: #0369a1; margin-bottom: 2px; }
  .proj-text { font-size: 8.5px; color: #0f172a; line-height: 1.32; }
  .proj-pill { background: #fff; border: 1px solid #bae6fd; border-radius: 5px; padding: 4px 7px; }
  .proj-pill-lbl { font-size: 7.4px; font-weight: 800; text-transform: uppercase; color: #0284c7; }
  .proj-pill-val { font-size: 10.2px; font-weight: 900; color: #0f172a; }
  .group-header { display: flex; justify-content: space-between; align-items: center; background: #1e293b; color: #fff; padding: 4.5px 9px; border-radius: 5px 5px 0 0; font-weight: 800; font-size: 9px; }
  .group-header span.sub { font-weight: 600; font-size: 8px; color: #cbd5e1; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; color: #334155; font-size: 7.7px; font-weight: 800; text-transform: uppercase; padding: 4px 5px; border: 1px solid #cbd5e1; text-align: left; }
  td { padding: 3.6px 5px; border: 1px solid #cbd5e1; vertical-align: middle; font-size: 8.7px; }
  tr.row-done { background: #f0fdf4; }
  tr.row-running { background: #fffbeb; }
  .col-check { width: 28px; text-align: center; }
  .checkbox { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border: 1.8px solid #334155; border-radius: 3px; background: #fff; font-size: 10px; font-weight: 900; line-height: 1; }
  .checkbox.checked { background: #16a34a; border-color: #15803d; color: #fff; }
  .checkbox.in-prog { background: #ffedd5; border-color: #ea580c; color: #ea580c; font-size: 8px; }
  .chapa-num { font-weight: 900; color: #0f172a; white-space: nowrap; }
  .file-name { font-weight: 700; color: #0f172a; white-space: nowrap; }
  .dim-text { font-size: 8.1px; color: #475569; white-space: nowrap; }
  .time-est { font-weight: 800; color: #0f172a; white-space: nowrap; }
  .badge { display: inline-block; padding: 1px 5px; border-radius: 99px; font-size: 7.4px; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
  .badge-done { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .badge-run { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
  .badge-pend { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  .log-detail { font-size: 8.2px; color: #1e293b; white-space: nowrap; }
  .write-line { color: #94a3b8; font-size: 8.2px; white-space: nowrap; }
  .extra-box { margin-top: 8px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .extra-title { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 2px; }
  .extra-items { font-size: 8.2px; color: #475569; }
  .footer-sigs { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; }
  .sig-block { text-align: center; padding-top: 16px; border-top: 1px solid #64748b; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; }
</style>
</head>
<body>${r}</body>
</html>`,a=window.open(``,`_blank`,`width=980,height=860`);if(!a){alert(`Permita pop-ups no navegador para abrir a janela de impressão/PDF da Ficha Técnica.`);return}a.document.open(),a.document.write(i),a.document.close(),a.focus(),setTimeout(()=>{a.print()},350)},className:`px-5 py-3 bg-orange-500 hover:bg-orange-400 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-orange-500/25 flex items-center gap-2.5 cursor-pointer shrink-0 transition-all`,children:[(0,d.jsx)(i,{size:16}),`Gerar PDF / Imprimir Ficha A4`]})]}),(0,d.jsxs)(`div`,{className:`glass rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3`,children:[(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2`,children:[(0,d.jsxs)(`button`,{onClick:()=>n(`lote`),className:`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all ${t===`lote`?`bg-orange-500 text-white shadow-md shadow-orange-500/20`:`bg-white/5 text-text-muted hover:text-white border border-white/10`}`,children:[(0,d.jsx)(r,{size:14}),`Modo Lote Seriado (Chapa 01 até N)`]}),(0,d.jsxs)(`button`,{onClick:()=>n(`arquivos`),className:`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all ${t===`arquivos`?`bg-orange-500 text-white shadow-md shadow-orange-500/20`:`bg-white/5 text-text-muted hover:text-white border border-white/10`}`,children:[(0,d.jsx)(l,{size:14}),`Modo Lista de Arquivos G-Code (Pasta)`]})]}),(0,d.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2`,children:[(0,d.jsx)(`span`,{className:`text-[10px] font-bold uppercase tracking-wider text-text-muted`,children:`Modelos Rápidos:`}),(0,d.jsx)(`button`,{onClick:()=>{n(`lote`),y(``),x(`mdf`),N(``),C(50),T(15),D(2),k(7),j(`08:00`),F(`LOTE SERIADO MDF 9MM · FICHA TÉCNICA`),L(`Controle Sequencial de Chapas`),z(`Fresa Topo Ø6mm (e6mm) · Passe Z 3mm`),V(`MDF 9mm (2750×1850mm) · F3200 · S18000`),U(`2750×1850mm · MDF 9mm`),G(``)},className:`px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 cursor-pointer transition-all`,children:`🧱 Lote Seriado MDF 9mm`}),(0,d.jsx)(`button`,{onClick:()=>{n(`arquivos`),y(``),x(`isopor`),N(``),D(2),k(8),j(`08:00`),F(`SETOR ISOPOR / EPS 3D · FICHA TÉCNICA`),L(`Lista de Usinagem de Blocos Isopor / PVC Expandido`),z(`Ball Nose Ø10mm / Ø12mm`),V(`Esp. 100mm · F6000 · S12000`),U(`Isopor 100mm`),G(``)},className:`px-3 py-1.5 rounded-xl text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 cursor-pointer transition-all`,children:`🧊 Setor Isopor / EPS 3D`}),(0,d.jsx)(`button`,{onClick:()=>{n(`lote`),y(``),x(``),N(``),C(50),T(10),D(2),k(7),j(`08:00`),F(`ORDEM DE CORTE · PENDÊNCIAS DA OFICINA`),L(`Controle de Materiais e Chapas Pendentes de Corte`),z(`Fresa Ø6mm / Ø4mm + Ball Nose`),V(`MDF, Compensado, PVC e Isopor · S18000 / F3200`),U(`Chapas 2750×1850 / Diversos`),G(`Conferir fixação das peças, zeramento de eixos e sequência de chapas concluídas.`)},className:`px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer transition-all`,children:`⚠️ Arquivos com Pendência`})]})]}),(0,d.jsxs)(`div`,{className:`grid grid-cols-1 lg:grid-cols-2 gap-5`,children:[(0,d.jsxs)(`div`,{className:`glass rounded-2xl p-5 border border-white/10 space-y-4`,children:[(0,d.jsxs)(`h3`,{className:`text-xs font-black uppercase tracking-widest text-orange-400 flex items-center gap-2`,children:[(0,d.jsx)(a,{size:14}),` 1. Fonte de Produção & Cálculo de Projeção`]}),(0,d.jsxs)(`div`,{className:`grid grid-cols-1 sm:grid-cols-2 gap-3`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Selecionar Projeto do Histórico`}),(0,d.jsxs)(`select`,{value:v,onChange:e=>ne(e.target.value),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`,children:[(0,d.jsx)(`option`,{value:``,children:`-- Filtrar por Palavra-Chave --`}),_.map(e=>(0,d.jsxs)(`option`,{value:e.folder,children:[e.folder,` (`,e.count,` cortes)`]},e.folder))]})]}),(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Palavra-Chave (Arquivo ou Pasta)`}),(0,d.jsx)(`input`,{type:`text`,value:b,onChange:e=>x(e.target.value),placeholder:`Ex: tijolo, pvc100mm, porta...`,className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`})]})]}),(0,d.jsxs)(`div`,{className:`grid grid-cols-2 sm:grid-cols-4 gap-3`,children:[t===`lote`&&(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Meta de Chapas`}),(0,d.jsx)(`input`,{type:`number`,min:1,max:500,value:S,onChange:e=>C(e.target.value),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-accent-cyan outline-none focus:border-orange-500`})]}),t===`lote`&&(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Corte Mín. (min)`}),(0,d.jsx)(`input`,{type:`number`,min:0,value:w,onChange:e=>T(e.target.value),title:`Ignora testes curtos ou abortados abaixo desta duração`,className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`})]}),(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Nº Routers Simult.`}),(0,d.jsxs)(`select`,{value:E,onChange:e=>D(Number(e.target.value)),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`,children:[(0,d.jsx)(`option`,{value:1,children:`1 Router`}),(0,d.jsx)(`option`,{value:2,children:`2 Routers`}),(0,d.jsx)(`option`,{value:3,children:`3 Routers`})]})]}),(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Troca Chapa (min)`}),(0,d.jsx)(`input`,{type:`number`,min:0,max:60,value:O,onChange:e=>k(e.target.value),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`})]})]}),(0,d.jsxs)(`div`,{className:`grid grid-cols-1 sm:grid-cols-2 gap-3`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Considerar Cortes a partir de`}),(0,d.jsx)(`input`,{type:`date`,value:M,onChange:e=>N(e.target.value),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`})]}),(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Horário Base p/ Projeção de Término`}),(0,d.jsx)(`input`,{type:`time`,value:A,onChange:e=>j(e.target.value),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`})]})]}),(0,d.jsxs)(`div`,{className:`pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2`,children:[(0,d.jsx)(`div`,{className:`text-[11px] text-text-muted`,children:K.length>0?(0,d.jsxs)(`span`,{className:`text-emerald-400 font-bold`,children:[`✓ `,K.length,` arquivo(s) G-Code simulado(s) da pasta!`]}):(0,d.jsx)(`span`,{children:"Opcional: carregue arquivos G-Code (`.txt`/`.nc`) para simular tempos e medidas exatas."})}),(0,d.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,d.jsxs)(`label`,{className:`px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-[11px] font-bold text-white flex items-center gap-1.5 cursor-pointer transition-all`,children:[(0,d.jsx)(c,{size:13,className:`text-orange-400`}),ee?`Simulando...`:`Importar G-Codes`,(0,d.jsx)(`input`,{type:`file`,multiple:!0,accept:`.txt,.nc,.tap,.gcode,.cnc`,onChange:re,className:`hidden`})]}),K.length>0&&(0,d.jsx)(`button`,{onClick:()=>q([]),className:`px-2.5 py-1.5 bg-red-500/15 text-red-300 rounded-xl text-[10px] font-bold cursor-pointer`,children:`Limpar`})]})]})]}),(0,d.jsxs)(`div`,{className:`glass rounded-2xl p-5 border border-white/10 space-y-3`,children:[(0,d.jsxs)(`h3`,{className:`text-xs font-black uppercase tracking-widest text-orange-400 flex items-center gap-2`,children:[(0,d.jsx)(s,{size:14}),` 2. Especificações da Ficha Técnica (Cabeçalho do PDF)`]}),(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Título Principal da O.S. / Projeto`}),(0,d.jsx)(`input`,{type:`text`,value:P,onChange:e=>F(e.target.value),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`})]}),(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Subtítulo / Caminho de Rede na Fábrica`}),(0,d.jsx)(`input`,{type:`text`,value:I,onChange:e=>L(e.target.value),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white outline-none focus:border-orange-500`})]}),(0,d.jsxs)(`div`,{className:`grid grid-cols-1 sm:grid-cols-3 gap-3`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Ferramenta / Fresa`}),(0,d.jsx)(`input`,{type:`text`,value:R,onChange:e=>z(e.target.value),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`})]}),(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Parâmetros (F / S)`}),(0,d.jsx)(`input`,{type:`text`,value:B,onChange:e=>V(e.target.value),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`})]}),(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Formato / Material`}),(0,d.jsx)(`input`,{type:`text`,value:H,onChange:e=>U(e.target.value),className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500`})]})]}),(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`label`,{className:`block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1`,children:`Notas de Rodapé / Aproveitamento de Testes (Opcional)`}),(0,d.jsx)(`input`,{type:`text`,value:W,onChange:e=>G(e.target.value),placeholder:`Ex: 3 chapas de teste do dia 29/10 disponíveis para montagem...`,className:`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500`})]})]})]}),t===`lote`?(0,d.jsxs)(`div`,{className:`glass rounded-3xl p-5 md:p-6 border border-white/10 space-y-5`,children:[(0,d.jsxs)(`div`,{className:`grid grid-cols-2 lg:grid-cols-4 gap-3`,children:[(0,d.jsxs)(`div`,{className:`p-4 rounded-2xl bg-white/[0.03] border border-white/10`,children:[(0,d.jsx)(`p`,{className:`text-[10px] font-black uppercase tracking-wider text-text-muted`,children:`Meta Total do Lote`}),(0,d.jsxs)(`p`,{className:`text-2xl font-black text-white mt-1`,children:[Z.totalGoal,` Chapas`]}),(0,d.jsx)(`p`,{className:`text-[11px] text-text-muted mt-0.5`,children:H})]}),(0,d.jsxs)(`div`,{className:`p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30`,children:[(0,d.jsx)(`p`,{className:`text-[10px] font-black uppercase tracking-wider text-emerald-400`,children:`Concluídas`}),(0,d.jsxs)(`p`,{className:`text-2xl font-black text-emerald-300 mt-1`,children:[Z.completedCount,` / `,Z.totalGoal,` (`,Math.min(100,Math.round(Z.completedCount/Z.totalGoal*100)),`%)`]}),(0,d.jsx)(`p`,{className:`text-[11px] text-emerald-200/70 mt-0.5`,children:Z.runningCount>0?`${Z.runningCount} em máquina agora`:`Sincronizado com Histórico`})]}),(0,d.jsxs)(`div`,{className:`p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30`,children:[(0,d.jsx)(`p`,{className:`text-[10px] font-black uppercase tracking-wider text-orange-400`,children:`Saldo Restante`}),(0,d.jsxs)(`p`,{className:`text-2xl font-black text-orange-300 mt-1`,children:[Z.pendingSheets,` Chapas`]}),(0,d.jsxs)(`p`,{className:`text-[11px] text-orange-200/70 mt-0.5`,children:[`Em 1 Router: ~`,p(Z.estRemainingMinSingle)]})]}),(0,d.jsxs)(`div`,{className:`p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30`,children:[(0,d.jsxs)(`p`,{className:`text-[10px] font-black uppercase tracking-wider text-sky-400`,children:[`Projeção (`,E,` `,E>1?`Routers`:`Router`,`)`]}),(0,d.jsxs)(`p`,{className:`text-2xl font-black text-sky-300 mt-1`,children:[`~`,p(Z.estRemainingMinMulti)]}),(0,d.jsxs)(`p`,{className:`text-[11px] text-sky-200/80 mt-0.5`,children:[`Início `,A,` ➔ Fim `,(0,d.jsxs)(`strong`,{children:[`~`,Z.projectedEndTimeStr]})]})]})]}),(0,d.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,d.jsxs)(`div`,{className:`flex justify-between text-[11px] font-bold`,children:[(0,d.jsxs)(`span`,{className:`text-emerald-400`,children:[`Progresso do Lote: `,Z.completedCount,` de `,Z.totalGoal,` chapas prontas`]}),(0,d.jsxs)(`span`,{className:`text-sky-300`,children:[`Ritmo medido: `,Z.sheetsPerHour.toFixed(2).replace(`.`,`,`),` chapas/hora (`,E,` máq.)`]})]}),(0,d.jsx)(`div`,{className:`h-3 bg-white/10 rounded-full overflow-hidden`,children:(0,d.jsx)(`div`,{className:`h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500`,style:{width:`${Math.min(100,Math.round(Z.completedCount/Z.totalGoal*100))}%`}})})]}),(0,d.jsx)(`div`,{className:`overflow-x-auto rounded-2xl border border-white/10 max-h-[540px] custom-scrollbar`,children:(0,d.jsxs)(`table`,{className:`w-full text-left border-collapse`,children:[(0,d.jsx)(`thead`,{className:`bg-slate-900/95 sticky top-0 z-10 text-[10px] font-black uppercase tracking-wider text-text-muted`,children:(0,d.jsxs)(`tr`,{children:[(0,d.jsx)(`th`,{className:`p-3 text-center w-12`,children:`OK`}),(0,d.jsx)(`th`,{className:`p-3`,children:`Nº Chapa`}),(0,d.jsx)(`th`,{className:`p-3`,children:`Arquivo G-Code`}),(0,d.jsx)(`th`,{className:`p-3`,children:`Formato / Material`}),(0,d.jsx)(`th`,{className:`p-3`,children:`Duração / Est.`}),(0,d.jsx)(`th`,{className:`p-3`,children:`Status`}),(0,d.jsx)(`th`,{className:`p-3`,children:`Máquina / Data / Horário`}),(0,d.jsx)(`th`,{className:`p-3`,children:`Operador`})]})}),(0,d.jsx)(`tbody`,{className:`divide-y divide-white/5 text-xs`,children:Z.rows.map(e=>(0,d.jsxs)(`tr`,{className:e.status===`done`?`bg-emerald-500/[0.06] hover:bg-emerald-500/[0.10]`:e.status===`running`?`bg-orange-500/[0.08]`:`hover:bg-white/[0.02]`,children:[(0,d.jsx)(`td`,{className:`p-2.5 text-center`,children:(0,d.jsx)(`button`,{type:`button`,onClick:()=>!e.routerName&&$(e.key),title:e.routerName?`Concluída via log automático do Mach3`:`Clique para marcar/desmarcar manualmente`,className:`w-5 h-5 rounded flex items-center justify-center font-black text-xs mx-auto transition-all ${e.status===`done`?`bg-emerald-500 text-white`:e.status===`running`?`bg-orange-500/20 border border-orange-400 text-orange-300`:`border border-white/25 bg-black/40 hover:border-orange-400 cursor-pointer`}`,children:e.status===`done`?`✓`:e.status===`running`?`▶`:``})}),(0,d.jsx)(`td`,{className:`p-2.5 font-black text-white whitespace-nowrap`,children:e.label}),(0,d.jsx)(`td`,{className:`p-2.5 font-semibold text-slate-200 whitespace-nowrap`,children:e.fileName}),(0,d.jsx)(`td`,{className:`p-2.5 text-text-muted whitespace-nowrap`,children:e.dimText}),(0,d.jsx)(`td`,{className:`p-2.5 font-bold text-accent-cyan whitespace-nowrap`,children:e.durText}),(0,d.jsx)(`td`,{className:`p-2.5 whitespace-nowrap`,children:e.status===`done`?(0,d.jsx)(`span`,{className:`px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30`,children:`Concluída`}):e.status===`running`?(0,d.jsx)(`span`,{className:`px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-500/20 text-orange-300 border border-orange-500/30 animate-pulse`,children:`Rodando`}):(0,d.jsx)(`span`,{className:`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/5 text-text-muted border border-white/10`,children:`Pendente`})}),(0,d.jsx)(`td`,{className:`p-2.5 text-slate-300 whitespace-nowrap`,children:e.routerName?(0,d.jsxs)(`span`,{children:[(0,d.jsx)(`strong`,{className:`text-white`,children:e.routerName}),` · `,e.timeRange]}):(0,d.jsx)(`span`,{className:`text-text-muted/60 font-mono text-[11px]`,children:`Máq: _______ · __:__ às __:__`})}),(0,d.jsx)(`td`,{className:`p-2.5 font-bold text-orange-300 whitespace-nowrap`,children:e.operator||(0,d.jsx)(`span`,{className:`text-text-muted/50`,children:`_______`})})]},e.key))})]})})]}):(0,d.jsxs)(`div`,{className:`glass rounded-3xl p-5 md:p-6 border border-white/10 space-y-5`,children:[(0,d.jsxs)(`div`,{className:`grid grid-cols-2 lg:grid-cols-4 gap-3`,children:[(0,d.jsxs)(`div`,{className:`p-4 rounded-2xl bg-white/[0.03] border border-white/10`,children:[(0,d.jsxs)(`p`,{className:`text-[10px] font-black uppercase tracking-wider text-text-muted`,children:[`Tempo Total (`,Q.items.length,` Arq.)`]}),(0,d.jsx)(`p`,{className:`text-2xl font-black text-white mt-1`,children:p(Q.totalEstMin)}),(0,d.jsxs)(`p`,{className:`text-[11px] text-text-muted mt-0.5`,children:[`~`,p(Q.totalEstMin/Math.max(1,E)),` em `,E,` Routers`]})]}),(0,d.jsxs)(`div`,{className:`p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30`,children:[(0,d.jsx)(`p`,{className:`text-[10px] font-black uppercase tracking-wider text-emerald-400`,children:`Concluídos`}),(0,d.jsxs)(`p`,{className:`text-2xl font-black text-emerald-300 mt-1`,children:[Q.doneCount,` / `,Q.items.length]}),(0,d.jsx)(`p`,{className:`text-[11px] text-emerald-200/70 mt-0.5`,children:Q.runCount>0?`${Q.runCount} rodando agora`:`Sincronizado com Histórico`})]}),(0,d.jsxs)(`div`,{className:`p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30`,children:[(0,d.jsx)(`p`,{className:`text-[10px] font-black uppercase tracking-wider text-orange-400`,children:`Fila Pendente`}),(0,d.jsxs)(`p`,{className:`text-2xl font-black text-orange-300 mt-1`,children:[Q.pendCount,` arquivos`]}),(0,d.jsxs)(`p`,{className:`text-[11px] text-orange-200/70 mt-0.5`,children:[`1 Máq: ~`,p(Q.pendMinSingle)]})]}),(0,d.jsxs)(`div`,{className:`p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30`,children:[(0,d.jsxs)(`p`,{className:`text-[10px] font-black uppercase tracking-wider text-sky-400`,children:[`Projeção (`,E,` Routers)`]}),(0,d.jsxs)(`p`,{className:`text-2xl font-black text-sky-300 mt-1`,children:[`~`,p(Q.pendMinMulti)]}),(0,d.jsxs)(`p`,{className:`text-[11px] text-sky-200/80 mt-0.5`,children:[`Início `,A,` ➔ Fim `,(0,d.jsxs)(`strong`,{children:[`~`,Q.projectedEndTimeStr]})]})]})]}),Object.entries(Q.groups).map(([e,t],n)=>(0,d.jsxs)(`div`,{className:`rounded-2xl border border-white/10 overflow-hidden`,children:[(0,d.jsxs)(`div`,{className:`bg-slate-800/90 px-4 py-2.5 flex items-center justify-between`,children:[(0,d.jsxs)(`span`,{className:`text-xs font-black uppercase tracking-wider text-white`,children:[n+1,`. Conjunto `,e]}),(0,d.jsxs)(`span`,{className:`text-[11px] text-text-muted font-bold`,children:[t.length,` arq. · Subtotal: `,p(t.reduce((e,t)=>e+(t.estimatedMinutes||0),0))]})]}),(0,d.jsx)(`div`,{className:`overflow-x-auto`,children:(0,d.jsxs)(`table`,{className:`w-full text-left border-collapse`,children:[(0,d.jsx)(`thead`,{className:`bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-text-muted`,children:(0,d.jsxs)(`tr`,{children:[(0,d.jsx)(`th`,{className:`p-2.5 text-center w-12`,children:`OK`}),(0,d.jsx)(`th`,{className:`p-2.5`,children:`Arquivo G-Code`}),(0,d.jsx)(`th`,{className:`p-2.5`,children:`Dimensões / Corte`}),(0,d.jsx)(`th`,{className:`p-2.5`,children:`Tempo Est.`}),(0,d.jsx)(`th`,{className:`p-2.5`,children:`Status`}),(0,d.jsx)(`th`,{className:`p-2.5`,children:`Execução / Máquina`}),(0,d.jsx)(`th`,{className:`p-2.5`,children:`Operador`})]})}),(0,d.jsx)(`tbody`,{className:`divide-y divide-white/5 text-xs`,children:t.map(e=>(0,d.jsxs)(`tr`,{className:e.status===`done`?`bg-emerald-500/[0.06]`:e.status===`running`?`bg-orange-500/[0.08]`:``,children:[(0,d.jsx)(`td`,{className:`p-2.5 text-center`,children:(0,d.jsx)(`button`,{type:`button`,onClick:()=>$(e.key),className:`w-5 h-5 rounded flex items-center justify-center font-black text-xs mx-auto cursor-pointer ${e.status===`done`?`bg-emerald-500 text-white`:e.status===`running`?`bg-orange-500/20 border border-orange-400 text-orange-300`:`border border-white/25 bg-black/40`}`,children:e.status===`done`?`✓`:e.status===`running`?`▶`:``})}),(0,d.jsx)(`td`,{className:`p-2.5 font-bold text-white`,children:e.fileName}),(0,d.jsx)(`td`,{className:`p-2.5 text-text-muted`,children:e.dimText}),(0,d.jsx)(`td`,{className:`p-2.5 font-bold text-accent-cyan`,children:e.estText}),(0,d.jsx)(`td`,{className:`p-2.5`,children:(0,d.jsx)(`span`,{className:`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${e.status===`done`?`bg-emerald-500/20 text-emerald-300`:e.status===`running`?`bg-orange-500/20 text-orange-300`:`bg-white/5 text-text-muted`}`,children:e.status===`done`?`Concluído`:e.status===`running`?`Rodando`:`Pendente`})}),(0,d.jsx)(`td`,{className:`p-2.5 text-slate-300`,children:e.routerName?`${e.routerName} · ${e.timeRange}`:`Máq: _______ · __:__ às __:__`}),(0,d.jsx)(`td`,{className:`p-2.5 font-bold text-orange-300`,children:e.operator||`_______`})]},e.key))})]})})]},e))]})]})}export{_ as GeradorFichaTecnica};