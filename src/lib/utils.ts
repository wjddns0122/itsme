import { createCn } from "cn/config";

// Design-token utilities from globals.css. Without this, the merger reads `text-body` as a color
// and drops it next to `text-ink` (or the other way round).
const TEXT_SIZES = ["caption", "label", "desc", "body", "section", "character", "question", "page", "kpi", "button", "button-lg"];
const RADII = ["ui-sm", "ui-md", "ui-lg", "ui-pill", "app-icon-lg", "app-icon-md", "app-icon-sm"];

export const cn = createCn({
  extend: {
    classGroups: { "font-size": [{ text: TEXT_SIZES }] },
    theme: { radius: RADII },
  },
});
