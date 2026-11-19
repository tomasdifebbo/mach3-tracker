function e(e){return String(e||``).replace(/\\/g,`/`).toLowerCase().trim()}function t(e,t){return`group::${String(e||`geral`).toLowerCase().trim()}___${String(t||`raiz`).toLowerCase().trim()}`}function n(e){let t=e?.fullPath||e?.fullFile?.fullPath||e?.fullFile?.path||``;return t?t.replace(/\//g,`\\`).trim():`${e?.baseName||e?.name||``}___${e?.subfolder||e?.subfolderName||``}`.trim()}function r(n=[],r){if(!Array.isArray(n)||n.length===0||!r)return[];let i=e(r.fullPath||r.fullFile?.fullPath||r.fullFile?.path||``),a=String(r.baseName||r.name||``).toLowerCase().trim(),o=String(r.subfolder||r.subfolderName||``).toLowerCase().trim(),s=String(r.jobName||``).toLowerCase().trim(),c=t(r.jobName,r.subfolder||r.subfolderName);return n.filter(t=>{if(!t)return!1;let n=e(t.file_key);if(n===c||i&&n&&n===i)return!0;let r=String(t.file_name||``).toLowerCase().trim(),l=String(t.subfolder||``).toLowerCase().trim(),u=String(t.job_name||``).toLowerCase().trim();return!!(r&&a&&r===a&&(!o||!l||o===l)||!r&&l&&o&&l===o&&(!u||!s||u===s))})}function i(e){return new Promise((t,n)=>{if(!e)return n(Error(`Nenhum arquivo selecionado`));let r=(e.type||``).toLowerCase(),i=r===`application/pdf`||e.name.toLowerCase().endsWith(`.pdf`),a=r.startsWith(`image/`);if(!i&&!a)return n(Error(`Envie uma imagem (JPG, PNG, WEBP) ou um arquivo PDF.`));if(i){if(e.size>7*1024*1024)return n(Error(`O PDF excede o limite de 7 MB.`));let r=new FileReader;r.onload=()=>{t({attachment_name:e.name,mime_type:`application/pdf`,data_url:String(r.result||``)})},r.onerror=()=>n(Error(`Erro ao ler o arquivo PDF.`)),r.readAsDataURL(e);return}let o=new FileReader;o.onload=()=>{let r=new Image;r.onload=()=>{let n=1600,{width:i,height:a}=r;if(i>n||a>n){let e=Math.min(n/i,n/a);i=Math.round(i*e),a=Math.round(a*e)}let o=document.createElement(`canvas`);o.width=i,o.height=a;let s=o.getContext(`2d`);s.fillStyle=`#ffffff`,s.fillRect(0,0,i,a),s.drawImage(r,0,0,i,a);let c=`image/jpeg`,l=o.toDataURL(c,.85);t({attachment_name:e.name,mime_type:c,data_url:l})},r.onerror=()=>n(Error(`Erro ao processar a imagem selecionada.`)),r.src=String(o.result||``)},o.onerror=()=>n(Error(`Erro ao ler a imagem.`)),o.readAsDataURL(e)})}function a(e){try{let t=String(e||``).split(`,`);if(t.length<2)return null;let n=t[0].match(/data:([^;]+);base64/i),r=n?n[1]:`application/octet-stream`,i=atob(t[1]),a=new Uint8Array(i.length);for(let e=0;e<i.length;e++)a[e]=i.charCodeAt(e);let o=new Blob([a],{type:r});return URL.createObjectURL(o)}catch{return null}}function o(e=[],t=[],n){let i=n||(e=>String(e||``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`)),a=new Set,o=[];for(let n of e){let e=`${String(n.jobName||``).toLowerCase()}___${String(n.subfolder||``).toLowerCase()}___${String(n.baseName||n.name||``).toLowerCase()}`;if(a.has(e))continue;a.add(e);let i=n.previewSvg||n.fullFile?.previewSvg||null,s=n.folderDocs||n.fullFile?.folderDocs||[],c=r(t,n);(i||c.length>0||s.length>0)&&o.push({item:n,previewSvg:i,folderDocs:s,attached:c})}if(o.length===0)return``;let s=o.map(({item:e,previewSvg:t,folderDocs:n,attached:r},a)=>{let o=r.filter(e=>(e.mime_type||``).startsWith(`image/`)),s=r.filter(e=>(e.mime_type||``)===`application/pdf`),c=n.filter(e=>e.ext===`.pdf`),l=n.filter(e=>e.ext!==`.pdf`&&e._dataUrl),u=(e.targetQuantity||1)>1?`<span class="map-qty">Lote ${e.targetQuantity}x</span>`:``,d=e._displayPath||e.fullPath||e.fullFile?.fullPath||``,f=t?`<div class="map-svg-wrap">${t}</div>`:``,p=[...o.map(e=>({name:e.attachment_name,url:e.data_url,notes:e.notes})),...l.map(e=>({name:e.name,url:e._dataUrl,notes:`Imagem da pasta do material`}))].map(e=>`
        <div class="map-photo-box">
          <div class="map-photo-caption">📎 ${i(e.name)}${e.notes?` — ${i(e.notes)}`:``}</div>
          <img src="${e.url}" alt="${i(e.name)}" class="map-photo-img" />
        </div>
      `).join(``),m=[...c.map(e=>`📄 PDF automático na pasta: <strong>${i(e.name)}</strong>`),...s.map(e=>`📄 PDF anexado: <strong>${i(e.attachment_name)}</strong>${e.notes?` (${i(e.notes)})`:``}`)],h=m.length>0?`<div class="map-pdf-note">${m.join(` &nbsp;|&nbsp; `)}</div>`:``;return`
      <div class="map-card">
        <div class="map-card-header">
          <div>
            <span class="map-num">#${a+1}</span>
            <strong>${i(e.baseName||e.name)}</strong>
            ${u}
          </div>
          <div class="map-meta">${i(e.material||``)}${e.dimensions?` · ${i(e.dimensions)}`:``}</div>
        </div>
        ${d?`<div class="map-path">📂 ${i(d)}</div>`:``}
        ${f}
        ${p}
        ${h}
        <div class="map-notes-area">
          <div class="map-notes-lbl">✏️ Anotações do Operador / Numeração das Peças:</div>
          <div class="map-notes-lines"></div>
          <div class="map-notes-lines"></div>
        </div>
      </div>
    `}).join(``);return`
    <div class="maps-section">
      <div class="maps-section-header">
        <span>📐 MAPAS DE PEÇAS & ANEXOS PARA ANOTAÇÃO DO OPERADOR</span>
        <span>${o.length} chapa(s) com desenho / anexo</span>
      </div>
      ${s}
    </div>
  `}var s=`
  .maps-section { page-break-before: always; }
  .maps-section-header { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 6px 10px; border-radius: 5px; font-weight: 900; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
  .map-card { border: 1.4px solid #334155; border-radius: 6px; padding: 7px 9px; margin-bottom: 10px; page-break-inside: avoid; background: #fff; }
  .map-card-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 4px; font-size: 9.2px; }
  .map-num { display: inline-block; background: #ea580c; color: #fff; font-weight: 900; font-size: 8px; padding: 1px 5px; border-radius: 3px; margin-right: 5px; }
  .map-qty { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; font-weight: 800; font-size: 7.5px; padding: 0.5px 5px; border-radius: 99px; margin-left: 5px; }
  .map-meta { font-size: 8px; font-weight: 700; color: #475569; }
  .map-path { font-size: 7.2px; font-family: Consolas, monospace; color: #334155; background: #f8fafc; padding: 2px 5px; border-left: 2px solid #ea580c; margin-bottom: 5px; word-break: break-all; }
  .map-svg-wrap { border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px; background: #fff; max-height: 290px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .map-svg-wrap svg { max-height: 280px; width: 100%; height: auto; }
  .map-photo-box { margin-top: 6px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px; background: #fff; text-align: center; }
  .map-photo-caption { font-size: 7.5px; font-weight: 700; color: #334155; text-align: left; margin-bottom: 3px; }
  .map-photo-img { max-width: 100%; max-height: 360px; object-fit: contain; display: block; margin: 0 auto; }
  .map-pdf-note { margin-top: 5px; font-size: 7.8px; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 3px 6px; }
  .map-notes-area { margin-top: 6px; padding-top: 4px; border-top: 1px dashed #94a3b8; }
  .map-notes-lbl { font-size: 7.5px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 3px; }
  .map-notes-lines { border-bottom: 1px dotted #94a3b8; height: 15px; }
`;export{a,o as i,n,i as o,t as r,r as s,s as t};