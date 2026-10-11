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
// A short heading in a tall body placeholder must not be vertically centered.
const defaultAnchor = { textBody: { props: {}, inheritProps: {} } };
const noProps = { textBody: {} };
const centered = { textBody: { props: { anchor: "ctr" } } };
const bottom = { textBody: { props: { anchor: "b" } } };
const inheritedCenter = { textBody: { props: {}, inheritProps: { anchor: "ctr" } } };
const explicitTop = { textBody: { props: { anchor: "t" }, inheritProps: { anchor: "ctr" } } };
repairMissingSlideShapes([{ nodes: [defaultAnchor, noProps, centered, bottom, inheritedCenter, explicitTop] }]);
assert.equal(defaultAnchor.textBody.props.anchor, "t");
assert.equal(noProps.textBody.props.anchor, "t");
assert.equal(centered.textBody.props.anchor, "ctr");
assert.equal(bottom.textBody.props.anchor, "b");
assert.equal(inheritedCenter.textBody.props.anchor, undefined);
assert.equal(inheritedCenter.textBody.inheritProps.anchor, "ctr");
assert.equal(explicitTop.textBody.props.anchor, "t");
const inlineEquationCaption = { textBody: { source: { "a:p": { "a:pPr": { "a:spcBef": { "a:spcPct": { attrs: { val: "50000" } } } } } }, paragraphs: [{ props: {}, rows: [{ props: { size: 24 } }] }] } };
repairMissingSlideShapes([inlineEquationCaption]);
assert.equal(inlineEquationCaption.textBody.paragraphs[0].props.spaceBefore, 12);
assert.equal(inlineEquationCaption.textBody.paragraphs[0].props.spaceAfter, undefined);
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
console.log("Slide frame checks passed: default top anchoring restored, explicit/inherited anchors preserved, missing fills restored, responsive fits and script isolation verified.");
