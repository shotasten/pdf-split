import { describe, expect, it } from "vitest";
import { degrees, PDFDocument } from "pdf-lib";
import { buildOutputFileName, getSplitParts, mapVisualRectToPageBox, normalizeRotation, snapToCenter, splitPdfWithPageBoxes } from "./pdf-split";

describe("PDF分割コア", () => {
  it("左右・上下の分割矩形と逆順を正しく作る", () => {
    expect(getSplitParts(1000, 800, "vertical", 60, "natural")).toEqual([
      { x: 0, y: 0, width: 600, height: 800 }, { x: 600, y: 0, width: 400, height: 800 }
    ]);
    expect(getSplitParts(1000, 800, "horizontal", 25, "reverse")).toEqual([
      { x: 0, y: 0, width: 1000, height: 600 }, { x: 0, y: 600, width: 1000, height: 200 }
    ]);
  });

  it("回転角を正規化し、見た目の矩形をPDF座標へ変換する", () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(mapVisualRectToPageBox({ x: 0, y: 0, width: 300, height: 600 }, { x: 10, y: 20, width: 600, height: 300 }, 90)).toEqual({ x: 10, y: 20, width: 600, height: 300 });
    expect(mapVisualRectToPageBox({ x: 0, y: 0, width: 300, height: 600 }, { x: 10, y: 20, width: 600, height: 300 }, 180)).toEqual({ x: 310, y: -280, width: 300, height: 600 });
  });

  it("各ページを2分割し、5種のページボックスを分割範囲に揃える", async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([1000, 800]);
    page.setCropBox(50, 40, 900, 700);
    page.setRotation(degrees(90));
    const bytes = await source.save();
    const outputBytes = await splitPdfWithPageBoxes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "vertical", 50, "natural");
    const output = await PDFDocument.load(outputBytes);
    expect(output.getPageCount()).toBe(2);
    for (const outputPage of output.getPages()) {
      expect(outputPage.getMediaBox()).toEqual(outputPage.getCropBox());
      expect(outputPage.getCropBox()).toEqual(outputPage.getBleedBox());
      expect(outputPage.getCropBox()).toEqual(outputPage.getTrimBox());
      expect(outputPage.getCropBox()).toEqual(outputPage.getArtBox());
    }
    expect(output.getPage(0).getCropBox()).toEqual({ x: 50, y: 40, width: 900, height: 350 });
  });

  it("中央吸着とダウンロード名の仕様を守る", () => {
    expect(snapToCenter(48.5)).toBe(50);
    expect(snapToCenter(52)).toBe(52);
    expect(buildOutputFileName("book.PDF")).toBe("book-split.pdf");
    expect(buildOutputFileName(undefined)).toBe("split.pdf");
  });
});
