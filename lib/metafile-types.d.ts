declare module "rtf.js/dist/WMFJS.bundle.js" {
  export function loggingEnabled(value: boolean): void;
  export class Renderer {
    constructor(buffer: ArrayBuffer);
    render(options: { width: string; height: string; xExt: number; yExt: number; wExt?: number; hExt?: number; mapMode: number }): SVGElement;
  }
}
declare module "rtf.js/dist/EMFJS.bundle.js" {
  export { loggingEnabled, Renderer } from "rtf.js/dist/WMFJS.bundle.js";
}
