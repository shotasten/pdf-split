import { PDFDocument } from "pdf-lib";

export type SplitDirection = "vertical" | "horizontal";
export type OutputOrder = "natural" | "reverse";
export type Rect = { x: number; y: number; width: number; height: number };

export function getSplitParts(width: number, height: number, direction: SplitDirection, splitRatio: number, outputOrder: OutputOrder): Rect[] {
  const ratio = splitRatio / 100;
  const parts = direction === "vertical"
    ? [{ x: 0, y: 0, width: width * ratio, height }, { x: width * ratio, y: 0, width: width * (1 - ratio), height }]
    : [{ x: 0, y: height * (1 - ratio), width, height: height * ratio }, { x: 0, y: 0, width, height: height * (1 - ratio) }];
  return outputOrder === "natural" ? parts : parts.reverse();
}

export function normalizeRotation(angle: number) { return ((angle % 360) + 360) % 360; }
export function getVisualSize(cropBox: Rect, rotation: number) { return rotation === 90 || rotation === 270 ? { width: cropBox.height, height: cropBox.width } : { width: cropBox.width, height: cropBox.height }; }
export function mapVisualRectToPageBox(rect: Rect, cropBox: Rect, rotation: number): Rect {
  switch (rotation) {
    case 90: return { x: cropBox.x + rect.y, y: cropBox.y + rect.x, width: rect.height, height: rect.width };
    case 180: return { x: cropBox.x + cropBox.width - rect.x - rect.width, y: cropBox.y + cropBox.height - rect.y - rect.height, width: rect.width, height: rect.height };
    case 270: return { x: cropBox.x + cropBox.width - rect.y - rect.height, y: cropBox.y + cropBox.height - rect.x - rect.width, width: rect.height, height: rect.width };
    default: return { x: cropBox.x + rect.x, y: cropBox.y + rect.y, width: rect.width, height: rect.height };
  }
}

export async function splitPdfWithPageBoxes(bytes: ArrayBuffer, direction: SplitDirection, splitRatio: number, outputOrder: OutputOrder) {
  const sourcePdf = await PDFDocument.load(bytes.slice(0));
  const outputPdf = await PDFDocument.create();
  for (let pageIndex = 0; pageIndex < sourcePdf.getPageCount(); pageIndex += 1) {
    const sourcePage = sourcePdf.getPage(pageIndex);
    const cropBox = sourcePage.getCropBox();
    const rotation = normalizeRotation(sourcePage.getRotation().angle);
    const visualSize = getVisualSize(cropBox, rotation);
    for (const part of getSplitParts(visualSize.width, visualSize.height, direction, splitRatio, outputOrder)) {
      const [newPage] = await outputPdf.copyPages(sourcePdf, [pageIndex]);
      const box = mapVisualRectToPageBox(part, cropBox, rotation);
      newPage.setMediaBox(box.x, box.y, box.width, box.height);
      newPage.setCropBox(box.x, box.y, box.width, box.height);
      newPage.setBleedBox(box.x, box.y, box.width, box.height);
      newPage.setTrimBox(box.x, box.y, box.width, box.height);
      newPage.setArtBox(box.x, box.y, box.width, box.height);
      outputPdf.addPage(newPage);
    }
  }
  return outputPdf.save();
}

export function snapToCenter(value: number) { return Math.abs(value - 50) <= 1.5 ? 50 : value; }
export function buildOutputFileName(fileName: string | undefined) { return fileName ? `${fileName.replace(/\.pdf$/i, "")}-split.pdf` : "split.pdf"; }
