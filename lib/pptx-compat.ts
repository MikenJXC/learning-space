import JSZip from "jszip";

const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";

function xml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Invalid PPT XML");
  return doc;
}

function resolvePart(base: string, target: string): string | null {
  if (/^[a-z]+:/i.test(target) || target.startsWith("//")) return null;
  const parts = target.startsWith("/") ? [] : base.split("/").slice(0, -1);
  for (const part of target.replace(/^\//, "").split("/")) {
    if (part === "..") { if (!parts.length) return null; parts.pop(); }
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

// Render only the embedded preview, never execute an OLE object or macro.
// Replace it at the same position/order as the original graphic frame.
export function restoreOlePictures(doc: Document): number {
  let restored = 0;
  for (const frame of Array.from(doc.getElementsByTagNameNS(P, "graphicFrame"))) {
    if (!frame.getElementsByTagNameNS(P, "oleObj").length) continue;
    const fallback = frame.getElementsByTagNameNS(MC, "Fallback")[0];
    const pic = (fallback ?? frame).getElementsByTagNameNS(P, "pic")[0];
    if (!pic || !pic.getElementsByTagNameNS(A, "blip")[0]?.getAttributeNS(R, "embed")) continue;
    const copy = pic.cloneNode(true) as typeof pic;
    const identity = frame.getElementsByTagNameNS(P, "cNvPr")[0];
    const pictureIdentity = copy.getElementsByTagNameNS(P, "cNvPr")[0];
    if (identity && pictureIdentity) {
      pictureIdentity.setAttribute("id", identity.getAttribute("id") ?? "0");
      pictureIdentity.setAttribute("name", identity.getAttribute("name") ?? "Embedded preview");
    }
    if (!copy.getElementsByTagNameNS(A, "xfrm").length) {
      const originalTransform = frame.getElementsByTagNameNS(P, "xfrm")[0];
      const shape = copy.getElementsByTagNameNS(P, "spPr")[0];
      if (originalTransform && shape) {
        const transform = doc.createElementNS(A, "a:xfrm");
        for (const attr of Array.from(originalTransform.attributes)) transform.setAttribute(attr.name, attr.value);
        for (const child of Array.from(originalTransform.children)) transform.appendChild(child.cloneNode(true));
        shape.insertBefore(transform, shape.firstChild);
      }
    }
    frame.parentNode?.replaceChild(copy, frame);
    restored++;
  }
  return restored;
}

// Classic Symbol is a byte-encoded font, not Unicode. Mobile devices often do
// not have it. Preserve glyph meaning using standard Unicode math characters.
export function decodeSymbolText(text: string, privateOnly = false): string {
  const upper = Array.from("ΑΒΧΔΕΦΓΗΙϑΚΛΜΝΟΠΘΡΣΤΥςΩΞΨΖ");
  const lower = Array.from("αβχδεφγηιϕκλμνοπθρστυϖωξψζ");
  const math: Record<number, string> = {
    0x22:"∀",0x24:"∃",0x27:"∋",0x2a:"∗",0x2d:"−",0x40:"≅",0x5c:"∴",0x5e:"⊥",0x7e:"∼",
    0xa0:"€",0xa1:"ϒ",0xa2:"′",0xa3:"≤",0xa4:"⁄",0xa5:"∞",0xa6:"ƒ",0xab:"↔",0xac:"←",0xad:"↑",0xae:"→",0xaf:"↓",
    0xb0:"°",0xb1:"±",0xb2:"″",0xb3:"≥",0xb4:"×",0xb5:"∝",0xb6:"∂",0xb7:"•",0xb8:"÷",0xb9:"≠",0xba:"≡",0xbb:"≈",0xbc:"…",0xbf:"↵",
    0xc0:"ℵ",0xc1:"ℑ",0xc2:"ℜ",0xc3:"℘",0xc4:"⊗",0xc5:"⊕",0xc6:"∅",0xc7:"∩",0xc8:"∪",0xc9:"⊃",0xca:"⊇",0xcb:"⊄",0xcc:"⊂",0xcd:"⊆",0xce:"∈",0xcf:"∉",
    0xd0:"∠",0xd1:"∇",0xd5:"∏",0xd6:"√",0xd7:"⋅",0xd8:"¬",0xd9:"∧",0xda:"∨",0xdb:"⇔",0xdc:"⇐",0xdd:"⇑",0xde:"⇒",0xdf:"⇓",0xe0:"◊",0xe1:"⟨",0xe5:"∑",0xf1:"⟩",0xf2:"∫",
    0x60:"⎷",0xbd:"│",0xbe:"─",0xe6:"⎛",0xe7:"⎜",0xe8:"⎝",0xe9:"⎡",0xea:"⎢",0xeb:"⎣",0xec:"⎧",0xed:"⎨",0xee:"⎩",0xef:"⎪",0xf3:"⌠",0xf4:"⎮",0xf5:"⌡",0xf6:"⎞",0xf7:"⎟",0xf8:"⎠",0xf9:"⎤",0xfa:"⎥",0xfb:"⎦",0xfc:"⎫",0xfd:"⎬",0xfe:"⎭",
  };
  return Array.from(text, (character) => {
    let code = character.codePointAt(0)!;
    if (privateOnly && (code < 0xf000 || code > 0xf0ff)) return character;
    if (code >= 0xf000 && code <= 0xf0ff) code &= 0xff;
    return code >= 65 && code <= 90 ? upper[code - 65] : code >= 97 && code <= 122 ? lower[code - 97] : math[code] ?? String.fromCodePoint(code);
  }).join("");
}

function normalizeSymbolRuns(doc: Document): number {
  let changed = 0;
  for (const run of Array.from(doc.getElementsByTagNameNS(A, "r"))) {
    const text = run.getElementsByTagNameNS(A, "t")[0];
    const props = run.getElementsByTagNameNS(A, "rPr")[0];
    if (!text || !props) continue;
    const fonts = Array.from(props.children).filter((child) => /^(latin|sym)$/.test(child.localName));
    if (!fonts.some((font) => /^symbol$/i.test(font.getAttribute("typeface") ?? ""))) continue;
    // a:sym can coexist with a normal Latin font: only private-use glyphs
    // belong to Symbol in that case. Never turn Latin R/t into Greek Ρ/τ.
    const latinIsSymbol = fonts.some((font) => font.localName === "latin" && /^symbol$/i.test(font.getAttribute("typeface") ?? ""));
    const original = text.textContent ?? "";
    const normalized = decodeSymbolText(original, !latinIsSymbol);
    if (normalized === original) continue;
    text.textContent = normalized;
    for (const font of fonts) font.setAttribute("typeface", "Cambria Math");
    changed++;
  }
  return changed;
}

// The metafile renderer omits LOGFONT weight/italic attributes. Read those
// attributes from the file's own GDI font selection, not from formula guesses.
export function wmfTextStyles(buffer: ArrayBuffer): { italic: boolean; weight: number }[] {
  const view = new DataView(buffer);
  const start = view.byteLength >= 40 && view.getUint32(0, true) === 0x9ac6cdd7 ? 40 : 18;
  const objects: ({ italic: boolean; weight: number } | false | null)[] = [];
  const result: { italic: boolean; weight: number }[] = [];
  let selected = { italic: false, weight: 400 };
  const stack: typeof selected[] = [];
  for (let offset = start, count = 0; offset + 6 <= view.byteLength; count++) {
    if (count >= 100000) throw new Error("Too many WMF records");
    const size = view.getUint32(offset, true) * 2;
    if (size < 6 || offset + size > view.byteLength) throw new Error("Invalid WMF record");
    const opcode = view.getUint16(offset + 4, true);
    if ([0x02fb,0x02fc,0x02fa,0x00f7,0x06ff,0x01f9,0x0142].includes(opcode)) {
      const font = opcode === 0x02fb && size >= 24 ? { italic: !!view.getUint8(offset + 16), weight: view.getUint16(offset + 14, true) } : false;
      const free = objects.findIndex((object) => object === null);
      if (free < 0) objects.push(font); else objects[free] = font;
    } else if (opcode === 0x012d && size >= 8) {
      const font = objects[view.getUint16(offset + 6, true)];
      if (font) selected = font;
    } else if (opcode === 0x01f0 && size >= 8) objects[view.getUint16(offset + 6, true)] = null;
    else if (opcode === 0x001e) stack.push(selected);
    else if (opcode === 0x0127) selected = stack.pop() ?? selected;
    else if (opcode === 0x0a32 || opcode === 0x0521) result.push(selected);
    offset += size;
  }
  return result;
}

export function metafileSize(buffer: ArrayBuffer, extension: string): { width: number; height: number } {
  const view = new DataView(buffer);
  if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("Metafile is too large to preview safely");
  let width = 0, height = 0;
  if (extension === "wmf" && view.byteLength >= 22 && view.getUint32(0, true) === 0x9ac6cdd7) {
    width = Math.abs(view.getInt16(10, true) - view.getInt16(6, true));
    height = Math.abs(view.getInt16(12, true) - view.getInt16(8, true));
  } else if (extension === "emf" && view.byteLength >= 40 && view.getUint32(0, true) === 1) {
    width = Math.abs(view.getInt32(16, true) - view.getInt32(8, true));
    height = Math.abs(view.getInt32(20, true) - view.getInt32(12, true));
  } else if (extension === "wmf" && view.byteLength >= 18) {
    // Non-placeable WMFs carry dimensions in META_SETWINDOWEXT.
    for (let offset = 18, count = 0; offset + 6 <= view.byteLength && count < 100000; count++) {
      const size = view.getUint32(offset, true) * 2;
      if (size < 6 || offset + size > view.byteLength) throw new Error("Invalid WMF record");
      if (view.getUint16(offset + 4, true) === 0x020c && size >= 10) {
        height = Math.abs(view.getInt16(offset + 6, true)); width = Math.abs(view.getInt16(offset + 8, true)); break;
      }
      offset += size;
    }
  }
  if (!width || !height || width > 100000 || height > 100000) throw new Error("Invalid metafile dimensions");
  return { width, height };
}

async function renderMetafile(buffer: ArrayBuffer, extension: string): Promise<string> {
  const { width, height } = metafileSize(buffer, extension);
  const fontStyles = extension === "wmf" ? wmfTextStyles(buffer) : [];
  const module = extension === "emf" ? await import("rtf.js/dist/EMFJS.bundle.js") : await import("rtf.js/dist/WMFJS.bundle.js");
  module.loggingEnabled(false);
  const svg = new module.Renderer(buffer).render({ width: String(width), height: String(height), xExt: width, yExt: height, wExt: width, hExt: height, mapMode: 8 });
  Array.from(svg.querySelectorAll("text")).forEach((text, index) => {
    text.setAttribute("xml:space", "preserve");
    text.setAttribute("style", `${text.getAttribute("style") ?? ""};white-space:pre`);
    if (fontStyles[index]) {
      text.setAttribute("font-style", fontStyles[index].italic ? "italic" : "normal");
      text.setAttribute("font-weight", String(fontStyles[index].weight));
    }
  });
  // Work only with inert, renderer-generated SVG. No OLE code is executed.
  svg.querySelectorAll("script,foreignObject,a").forEach((node) => node.remove());
  for (const node of Array.from(svg.querySelectorAll("*"))) {
    for (const attr of Array.from(node.attributes)) {
      if (/^on/i.test(attr.name) || (attr.localName === "href" && !/^(#|data:image\/)/.test(attr.value))) node.removeAttributeNode(attr);
    }
  }
  for (const text of Array.from(svg.querySelectorAll("text,tspan"))) {
    if (/^symbol$/i.test(text.getAttribute("font-family") ?? "")) {
      text.textContent = decodeSymbolText(text.textContent ?? "");
      text.setAttribute("font-family", "Cambria Math,STIX Two Math,DejaVu Serif,serif");
    }
  }
  return new XMLSerializer().serializeToString(svg);
}

export async function preparePptxPreview(buffer: ArrayBuffer): Promise<{ buffer: ArrayBuffer; incomplete: boolean }> {
  const zip = await JSZip.loadAsync(buffer);
  let changed = false, incomplete = false;
  const converted = new Map<string, string>();
  for (const part of Object.keys(zip.files).filter((name) => /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(name))) {
    const source = await zip.file(part)!.async("string");
    const doc = xml(source);
    const olePictures = restoreOlePictures(doc);
    // Never silently claim a complete preview for an object without a usable
    // embedded picture, or for modern math markup this renderer cannot read.
    if (doc.getElementsByTagNameNS(P, "oleObj").length || doc.getElementsByTagNameNS("http://schemas.openxmlformats.org/officeDocument/2006/math", "oMath").length) incomplete = true;
    let partChanged = normalizeSymbolRuns(doc) > 0 || olePictures > 0;
    const relPath = part.replace(/([^/]+)$/, "_rels/$1.rels");
    const relFile = zip.file(relPath);
    if (relFile) {
      const rels = xml(await relFile.async("string"));
      let relChanged = false;
      for (const relation of Array.from(rels.getElementsByTagNameNS(REL, "Relationship"))) {
        const target = relation.getAttribute("Target") ?? "";
        if (relation.getAttribute("TargetMode") === "External" || !/\.(wmf|emf)$/i.test(target) || !relation.getAttribute("Type")?.endsWith("/image")) continue;
        const path = resolvePart(part, target);
        if (!path || !zip.file(path)) { incomplete = true; continue; }
        try {
          let svgPath = converted.get(path);
          if (!svgPath) {
            const svg = await renderMetafile(await zip.file(path)!.async("arraybuffer"), path.split(".").pop()!.toLowerCase());
            svgPath = `${path}.preview.svg`;
            zip.file(svgPath, svg);
            converted.set(path, svgPath);
          }
          relation.setAttribute("Target", `${target}.preview.svg`);
          relChanged = true;
        } catch { incomplete = true; }
      }
      if (relChanged) { zip.file(relPath, new XMLSerializer().serializeToString(rels)); changed = true; }
    }
    if (partChanged) { zip.file(part, new XMLSerializer().serializeToString(doc)); changed = true; }
  }
  if (converted.size) {
    const types = xml(await zip.file("[Content_Types].xml")!.async("string"));
    if (!Array.from(types.getElementsByTagNameNS("*", "Default")).some((node) => node.getAttribute("Extension") === "svg")) {
      const entry = types.createElementNS(types.documentElement.namespaceURI, "Default");
      entry.setAttribute("Extension", "svg"); entry.setAttribute("ContentType", "image/svg+xml"); types.documentElement.appendChild(entry);
      zip.file("[Content_Types].xml", new XMLSerializer().serializeToString(types));
    }
  }
  return { buffer: changed ? await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 1 } }) : buffer, incomplete };
}
