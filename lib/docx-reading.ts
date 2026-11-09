import type { ReadingProgress } from "./library-types";

export const DOCX_READING_UNITS = 10000;
export function docxReadingPosition(scrollTop: number, scrollHeight: number, clientHeight: number) {
  const range = Math.max(0, scrollHeight - clientHeight);
  return range <= 1 ? DOCX_READING_UNITS : Math.max(1, Math.min(DOCX_READING_UNITS, 1 + Math.round(Math.max(0, scrollTop) / range * (DOCX_READING_UNITS - 1))));
}
export function docxRestoreFraction(progress: ReadingProgress | null) {
  return progress ? Math.max(0, Math.min(1, (progress.page - 1) / Math.max(1, progress.totalPages - 1))) : 0;
}

// Mammoth does not sanitize uploaded documents. Only inert document markup
// and embedded bitmap images reach the isolated reader frame.
export function sanitizeDocxHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const allowed = new Set(["P", "DIV", "SPAN", "H1", "H2", "H3", "H4", "H5", "H6", "STRONG", "B", "EM", "I", "U", "S", "SUP", "SUB", "BR", "HR", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "IMG", "A", "BLOCKQUOTE", "PRE", "CODE"]);
  for (const element of [...doc.body.querySelectorAll("*")]) {
    if (!allowed.has(element.tagName)) { element.remove(); continue; }
    for (const attribute of [...element.attributes]) {
      const safeImage = element.tagName === "IMG" && (attribute.name === "alt" || attribute.name === "src" && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(attribute.value));
      const safeSpan = ["TD", "TH"].includes(element.tagName) && ["colspan", "rowspan"].includes(attribute.name) && /^\d{1,3}$/.test(attribute.value);
      if (!safeImage && !safeSpan) element.removeAttribute(attribute.name);
    }
  }
  return doc.body.innerHTML;
}

export function docxFrameDocument(html: string, restoredFraction: number, nonce: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><style>body{margin:0;background:#eef2f8;color:#182033;font:16px/1.8 ui-sans-serif,system-ui}article{box-sizing:border-box;max-width:860px;min-height:100vh;margin:28px auto;padding:64px 72px;background:#fff;box-shadow:0 16px 45px #13213a1c;border-radius:8px;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}td,th{border:1px solid #d9dee8;padding:8px}h1,h2,h3{line-height:1.3}@media(max-width:700px){article{margin:0;padding:28px 22px;border-radius:0}}</style></head><body><article>${html}</article><script nonce="${nonce}">(()=>{let active=false,queued=false;const units=${DOCX_READING_UNITS};function report(){queued=false;if(!active)return;const el=document.scrollingElement;const range=Math.max(0,el.scrollHeight-innerHeight);const page=range<=1?units:Math.max(1,Math.min(units,1+Math.round(el.scrollTop/range*(units-1))));parent.postMessage({type:'study-docx-position',page,totalPages:units},'*');}function queue(){if(!queued){queued=true;requestAnimationFrame(report);}}async function start(){await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve})));if(document.fonts)await document.fonts.ready;requestAnimationFrame(()=>requestAnimationFrame(()=>{const el=document.scrollingElement;scrollTo(0,${restoredFraction}*Math.max(0,el.scrollHeight-innerHeight));active=true;queue();}));}addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);start();})();</script></body></html>`;
}
