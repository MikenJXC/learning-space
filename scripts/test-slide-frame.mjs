import assert from "node:assert/strict";
import { getSlideFitScale, repairMissingSlideShapes, SLIDE_FRAME_DOCUMENT, SLIDE_WIDTH } from "../lib/slide-frame.ts";

const missing = { textBody: {}, background: { type: "solidFill" } };
const transparent = { textBody: {}, background: { type: "none" } };
const ellipse = { shape: "ellipse", textBody: {}, background: { type: "solidFill" } };
const picture = { background: { type: "blipFill" } };
repairMissingSlideShapes([{ nodes: [missing, transparent, ellipse, picture] }]);
assert.equal(missing.shape, "rect");
assert.equal(transparent.shape, undefined);
assert.equal(ellipse.shape, "ellipse");
assert.equal(picture.shape, undefined);
assert.ok(SLIDE_FRAME_DOCUMENT.includes(`width=${SLIDE_WIDTH}`));
assert.ok(SLIDE_FRAME_DOCUMENT.includes("text-size-adjust:none!important"));
assert.ok(SLIDE_FRAME_DOCUMENT.includes("script-src 'none'"));
assert.ok(!SLIDE_FRAME_DOCUMENT.includes("<script"));
for (const [width, height] of [[320, 300], [360, 500], [390, 600], [430, 650], [844, 220], [768, 900], [1440, 800]]) {
  for (const slideHeight of [720, 960, 1800]) {
    const scale = getSlideFitScale(width, height, slideHeight);
    assert.ok(SLIDE_WIDTH * scale <= width - 32 + 0.001);
    assert.ok(slideHeight * scale <= height - 32 + 0.001);
  }
}
console.log("Slide frame checks passed: missing fill geometry restored, existing shapes unchanged, scripts blocked.");
