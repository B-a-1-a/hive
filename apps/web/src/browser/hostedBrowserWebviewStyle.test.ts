import { describe, expect, it } from "vite-plus/test";

import { resolveHostedBrowserWebviewWrapperStyle } from "./hostedBrowserWebviewStyle";

const inactive = {
  active: false,
  renderingActive: false,
  rect: null,
  hiddenSize: { width: 1280, height: 800 },
};

describe("hosted browser paintability", () => {
  it("keeps capture-capable inactive guests inside the compositor without accepting input", () => {
    const style = resolveHostedBrowserWebviewWrapperStyle({
      ...inactive,
      keepPaintableWhenInactive: true,
    });
    // Visibility alone cannot make an off-window Electron guest paint a screenshot.
    expect(style.left + style.width).toBeGreaterThan(0);
    expect(style.top + style.height).toBeGreaterThan(0);
    expect(style.visibility).toBe("visible");
    expect(style.zIndex).toBeLessThan(0);
    expect(style.pointerEvents).toBe("none");
  });

  it("suspends inactive guests that do not require capture", () => {
    const style = resolveHostedBrowserWebviewWrapperStyle(inactive);
    expect(style.left + style.width).toBeLessThan(0);
    expect(style.top + style.height).toBeLessThan(0);
    expect(style.visibility).toBe("hidden");
  });

  it("preserves the visible surface position and input ownership", () => {
    const rect = { x: 300, y: 80, width: 700, height: 600 };
    const style = resolveHostedBrowserWebviewWrapperStyle({
      ...inactive,
      active: true,
      rect,
      keepPaintableWhenInactive: true,
    });
    expect(style).toMatchObject({
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      pointerEvents: "auto",
    });
  });
});
