// A slide has fixed coordinates. Keep its document viewport and styles separate
// from the responsive app, then scale an inert image rather than live text.
// No scripts run inside this document; the parent mounts the trusted renderer.
export const SLIDE_WIDTH = 1280;

export function getSlideFitScale(viewportWidth: number, viewportHeight: number, slideHeight: number, padding = 32): number {
  if (viewportWidth <= 0 || viewportHeight <= 0 || slideHeight <= 0) return 0.01;
  return Math.max(0.001, Math.min((viewportWidth - padding) / SLIDE_WIDTH, (viewportHeight - padding) / slideHeight));
}

// SVG image documents have a fixed viewBox and cannot be reflowed by mobile
// browsers' smart text layout. All content comes from the local PPT renderer.
// No uploaded file is sent to a conversion service.
export function createSlideImage(host: HTMLElement, height: number): string {
  const slide = host.querySelector<HTMLElement>(".pptx-preview-slide-wrapper");
  if (!slide) throw new Error("此页未能生成预览");
  const clone = slide.cloneNode(true) as HTMLElement;
  clone.style.margin = "0";
  clone.style.width = `${SLIDE_WIDTH}px`;
  clone.style.height = `${height}px`;
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  // Some decks reserve an inline equation's position using leading spaces.
  // HTML collapsing those spaces makes the neighboring caption overlap it.
  clone.querySelectorAll<HTMLElement>("p").forEach((node) => {
    node.style.whiteSpace = /^[ \t]{2,}\S/.test(node.textContent ?? "") ? "pre" : "pre-wrap";
  });
  // Image previews must remain inert, including hyperlinks in uploaded files.
  clone.querySelectorAll("script, iframe, object, embed").forEach((node) => node.remove());
  clone.querySelectorAll("*").forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name.toLowerCase().startsWith("on") || (attribute.name.endsWith("href") && !attribute.value.startsWith("#"))) node.removeAttribute(attribute.name);
    }
  });
  const content = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_WIDTH}" height="${height}" viewBox="0 0 ${SLIDE_WIDTH} ${height}"><foreignObject width="${SLIDE_WIDTH}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${SLIDE_WIDTH}px;height:${height}px;font-family:Arial,'Microsoft YaHei','PingFang SC',sans-serif;font-size:16px;line-height:normal;color:#000;text-size-adjust:none;-webkit-text-size-adjust:none">${content}</div></foreignObject></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type SlideNode = {
  shape?: string;
  background?: { type?: string };
  textBody?: {
    props?: { anchor?: string };
    inheritProps?: { anchor?: string };
    source?: { "a:p"?: unknown };
    paragraphs?: { props: { spaceBefore?: number; spaceAfter?: number }; rows?: { props?: { size?: number } }[]; endParaRProps?: { size?: number }; inheritRProps?: { size?: number } }[];
  };
  nodes?: SlideNode[];
};

export function repairMissingSlideShapes(nodes: SlideNode[]): void {
  for (const node of nodes) {
    // DrawingML's default body anchor is top. pptx-preview instead centers
    // non-textbox placeholders when the attribute is absent, moving a short
    // heading into the middle of its large placeholder and behind pictures.
    // Keep explicit and inherited anchors (especially ctr/b) unchanged.
    if (node.textBody && !node.textBody.props?.anchor && !node.textBody.inheritProps?.anchor) {
      node.textBody.props = { ...node.textBody.props, anchor: "t" };
    }
    // Percentage paragraph spacing is ignored by pptx-preview. It matters
    // when a separately positioned equation sits beside the next text line.
    const sourceParagraphs = node.textBody?.source?.["a:p"];
    const rawParagraphs = Array.isArray(sourceParagraphs) ? sourceParagraphs : sourceParagraphs ? [sourceParagraphs] : [];
    node.textBody?.paragraphs?.forEach((paragraph, index) => {
      const raw = rawParagraphs[index] as { "a:pPr"?: Record<string, { "a:spcPct"?: { attrs?: { val?: string } } }> } | undefined;
      const fontSize = Math.max(0, paragraph.endParaRProps?.size ?? 0, paragraph.inheritRProps?.size ?? 0, ...(paragraph.rows ?? []).map((row) => row.props?.size ?? 0));
      if (!fontSize) return;
      for (const [element, property] of [["a:spcBef", "spaceBefore"], ["a:spcAft", "spaceAfter"]] as const) {
        const percent = Number(raw?.["a:pPr"]?.[element]?.["a:spcPct"]?.attrs?.val);
        if (Number.isFinite(percent) && percent >= 0) paragraph.props[property] = fontSize * percent / 100000;
      }
    });
    // The renderer skips the fill entirely when an ordinary filled text box
    // has no explicit geometry. Preserve its own fill; never invent a color.
    if (!node.shape && "textBody" in node && node.background?.type && node.background.type !== "none") {
      node.shape = "rect";
    }
    if (node.nodes) repairMissingSlideShapes(node.nodes);
  }
}

export const SLIDE_FRAME_DOCUMENT = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=${SLIDE_WIDTH},initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; base-uri 'none'; form-action 'none'">
<style>
html,body{margin:0;padding:0;width:${SLIDE_WIDTH}px;height:100%;overflow:hidden;background:transparent}
html,body,*{-webkit-text-size-adjust:none!important;text-size-adjust:none!important}
body{font-family:Arial,"Microsoft YaHei","PingFang SC",sans-serif;font-size:16px;line-height:normal;color:#000}
#slide-root{position:relative;width:${SLIDE_WIDTH}px;height:100%;isolation:isolate}
/* Keep browser and app defaults out of the PPT's inline coordinate styles. */
p{margin:0;padding:0}img,svg{max-width:none;max-height:none}img{display:inline-block}
a{color:inherit;text-decoration:inherit;pointer-events:none}
</style></head><body><div id="slide-root"></div></body></html>`;
