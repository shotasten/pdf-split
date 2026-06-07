"use client";

import Image from "next/image";
import SiteFrame from "./site-frame";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import type { PDFPageProxy } from "pdfjs-dist";

type SplitDirection = "vertical" | "horizontal";
type OutputOrder = "natural" | "reverse";

type PdfPage = {
  width: number;
  height: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const splitDirectionLabels: Record<SplitDirection, string> = {
  vertical: "左右に分割",
  horizontal: "上下に分割"
};

const outputOrderLabels: Record<SplitDirection, Record<OutputOrder, string>> = {
  vertical: {
    natural: "左ページから",
    reverse: "右ページから"
  },
  horizontal: {
    natural: "上ページから",
    reverse: "下ページから"
  }
};


function clearCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
}

async function drawPage(canvas: HTMLCanvasElement | null, page: PDFPageProxy) {
  if (!canvas) {
    return;
  }

  const viewport = page.getViewport({ scale: 1 });
  const previewStage = canvas.closest<HTMLElement>(".preview-stage");
  const availableWidth = previewStage ? Math.max(260, previewStage.clientWidth - 24) : 840;
  const maxPreviewWidth = Math.min(840, availableWidth);
  const scale = Math.min(maxPreviewWidth / viewport.width, 1);
  const scaledViewport = page.getViewport({ scale });
  const pixelRatio = window.devicePixelRatio || 1;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = Math.floor(scaledViewport.width * pixelRatio);
  canvas.height = Math.floor(scaledViewport.height * pixelRatio);
  canvas.style.width = `${Math.floor(scaledViewport.width)}px`;
  canvas.style.height = "auto";
  canvas.style.aspectRatio = `${scaledViewport.width} / ${scaledViewport.height}`;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, scaledViewport.width, scaledViewport.height);

  await page.render({
    canvasContext: context,
    viewport: scaledViewport
  }).promise;
}

function getPageSize(page: PDFPageProxy): PdfPage {
  const viewport = page.getViewport({ scale: 1 });
  return {
    width: viewport.width,
    height: viewport.height
  };
}

export default function PdfSplitApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [previewPageNumber, setPreviewPageNumber] = useState(1);
  const [previewPage, setPreviewPage] = useState<PdfPage | null>(null);
  const [direction, setDirection] = useState<SplitDirection>("vertical");
  const [splitRatio, setSplitRatio] = useState(50);
  const [outputOrder, setOutputOrder] = useState<OutputOrder>("natural");
  const [isRendering, setIsRendering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCharacterMenuOpen, setIsCharacterMenuOpen] = useState(false);
  const [isClearConfirming, setIsClearConfirming] = useState(false);

  const pageLabel = useMemo(() => {
    if (!previewPage || pageCount === 0) {
      return "";
    }

    return `${pageCount}ページ / ${previewPageNumber}ページ目 ${Math.round(previewPage.width)} x ${Math.round(previewPage.height)} pt`;
  }, [pageCount, previewPage, previewPageNumber]);
  const splitPositionLabel = useMemo(() => {
    const offset = Math.abs(splitRatio - 50);

    if (offset === 0) {
      return "中央";
    }

    const directionLabel = direction === "vertical"
      ? splitRatio > 50 ? "右へ" : "左へ"
      : splitRatio > 50 ? "下へ" : "上へ";

    return `${directionLabel} +${formatPercent(offset)}%`;
  }, [direction, splitRatio]);

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  useEffect(() => {
    if (!pdfBytes) {
      clearCanvas(canvasRef.current);
      return;
    }

    const bytes = pdfBytes;
    let cancelled = false;

    async function renderPreview() {
      setIsRendering(true);
      setError(null);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url
        ).toString();

        const documentTask = pdfjs.getDocument({ data: bytes.slice(0) });
        const pdf = await documentTask.promise;

        if (cancelled) {
          return;
        }

        setPageCount(pdf.numPages);
        setPreviewPageNumber(1);
      } catch (previewError) {
        console.error(previewError);
        setError("PDFのプレビュー生成に失敗しました。別のPDFで試してください。");
        setPageCount(0);
        setPreviewPage(null);
        clearCanvas(canvasRef.current);
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    renderPreview();

    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  useEffect(() => {
    if (!pdfBytes || previewPageNumber < 1) {
      return;
    }

    const bytes = pdfBytes;
    let cancelled = false;

    async function renderSelectedPreviewPage() {
      setIsRendering(true);
      setError(null);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url
        ).toString();

        const documentTask = pdfjs.getDocument({ data: bytes.slice(0) });
        const pdf = await documentTask.promise;
        const page = await pdf.getPage(previewPageNumber);

        if (cancelled) {
          return;
        }

        setPreviewPage(getPageSize(page));
        await drawPage(canvasRef.current, page);
      } catch (previewError) {
        console.error(previewError);
        setError("PDFのプレビュー生成に失敗しました。別のPDFで試してください。");
        setPreviewPage(null);
        clearCanvas(canvasRef.current);
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    renderSelectedPreviewPage();

    return () => {
      cancelled = true;
    };
  }, [pdfBytes, previewPageNumber]);


  async function loadPdfFile(selectedFile: File | null) {
    setFile(selectedFile);
    setPreviewPage(null);
    setPreviewPageNumber(1);
    setPageCount(0);
    setError(null);
    closeCharacterMenu();
    setDownloadUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return null;
    });

    if (!selectedFile) {
      setPdfBytes(null);
      return;
    }

    if (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setPdfBytes(null);
      setError("PDFファイルを選択してください。");
      return;
    }

    setPdfBytes(await selectedFile.arrayBuffer());
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    await loadPdfFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setIsDragging(false);
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    await loadPdfFile(event.dataTransfer.files?.[0] ?? null);
  }
  function goToPreviousPage() {
    setPreviewPageNumber((currentPage) => Math.max(1, currentPage - 1));
  }

  function goToNextPage() {
    setPreviewPageNumber((currentPage) => Math.min(pageCount, currentPage + 1));
  }

  async function handleDownload() {
    if (!pdfBytes || !file) {
      setError("分割するPDFを選択してください。");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const sourcePdf = await PDFDocument.load(pdfBytes.slice(0));
      const outputPdf = await PDFDocument.create();
      const sourcePageCount = sourcePdf.getPageCount();

      for (let pageIndex = 0; pageIndex < sourcePageCount; pageIndex += 1) {
        const sourcePage = sourcePdf.getPage(pageIndex);
        const cropBox = sourcePage.getCropBox();
        const rotation = normalizeRotation(sourcePage.getRotation().angle);
        const visualSize = getVisualSize(cropBox, rotation);
        const parts = getSplitParts(visualSize.width, visualSize.height, direction, splitRatio, outputOrder);

        for (const part of parts) {
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

      const outputBytes = await outputPdf.save();
      const blob = new Blob([outputBytes], { type: "application/pdf" });
      const nextUrl = URL.createObjectURL(blob);

      setDownloadUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return nextUrl;
      });
    } catch (processingError) {
      console.error(processingError);
      setError("PDFの分割に失敗しました。パスワード付きPDFや破損したPDFは処理できない場合があります。");
    } finally {
      setIsProcessing(false);
    }
  }

  const markerStyle =
    direction === "vertical"
      ? { left: `${splitRatio}%` }
      : { top: `${splitRatio}%` };

  function handleSplitRatioChange(event: ChangeEvent<HTMLInputElement>) {
    const nextRatio = Number(event.target.value);
    setSplitRatio(snapToCenter(nextRatio));
  }

  function closeCharacterMenu() {
    setIsCharacterMenuOpen(false);
    setIsClearConfirming(false);
  }

  function resetLoadedPdf() {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }

    setFile(null);
    setPdfBytes(null);
    setPageCount(0);
    setPreviewPageNumber(1);
    setPreviewPage(null);
    setDownloadUrl(null);
    setError(null);
    setIsProcessing(false);
    clearCanvas(canvasRef.current);
    closeCharacterMenu();
  }

  return (
    <SiteFrame>
      <section id="tool" className="workspace" aria-label="PDF見開き分割くん">
        <div className="control-panel">
          <label
            className={`file-picker${isDragging ? " is-dragging" : ""}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} />
            <span>{isDragging ? "ここにPDFをドロップ" : "PDFを選択 / ドロップ"}</span>
            <strong>{file ? file.name : "未選択"}</strong>
          </label>

          <div className="field-group">
            <span className="field-label">分割方向</span>
            <div className="segmented-control" role="radiogroup" aria-label="分割方向">
              {(["vertical", "horizontal"] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="direction"
                    value={value}
                    checked={direction === value}
                    onChange={() => setDirection(value)}
                  />
                  <span>{splitDirectionLabels[value]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field-group">
            <div className="split-label-row">
              <label className="field-label" htmlFor="split-ratio">
                分割位置
              </label>
              <output htmlFor="split-ratio">{splitPositionLabel}</output>
            </div>
            <div className="range-wrap">
              <input
                id="split-ratio"
                className="range-input"
                type="range"
                min="20"
                max="80"
                step="0.5"
                value={splitRatio}
                onChange={handleSplitRatioChange}
              />
              <span className="range-center-mark" aria-hidden="true" />
            </div>
          </div>

          <div className="field-group">
            <span className="field-label">出力順</span>
            <div className="segmented-control" role="radiogroup" aria-label="出力順">
              {(["natural", "reverse"] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="outputOrder"
                    value={value}
                    checked={outputOrder === value}
                    onChange={() => setOutputOrder(value)}
                  />
                  <span>{outputOrderLabels[direction][value]}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="primary-button" type="button" onClick={handleDownload} disabled={!pdfBytes || isProcessing}>
            {isProcessing ? "分割中..." : "分割PDFを作成"}
          </button>

          {downloadUrl ? (
            <a className="download-link" href={downloadUrl} download={buildOutputFileName(file?.name)}>
              分割後PDFをダウンロード
            </a>
          ) : null}

          {error ? <p className="error-message">{error}</p> : null}
        </div>

        <div className={`preview-panel${pdfBytes ? "" : " is-empty"}`}>
          <div className="preview-header">
            <p>プレビュー</p>
            {pageCount > 1 ? (
              <div className="page-controls" aria-label="プレビューページ送り">
                <button type="button" onClick={goToPreviousPage} disabled={previewPageNumber <= 1 || isRendering}>
                  前へ
                </button>
                <span>{previewPageNumber} / {pageCount}</span>
                <button type="button" onClick={goToNextPage} disabled={previewPageNumber >= pageCount || isRendering}>
                  次へ
                </button>
              </div>
            ) : null}
          </div>
          <div className="preview-stage">
            <div className="preview-character">
              <button
                className="character-button"
                type="button"
                aria-expanded={isCharacterMenuOpen}
                aria-label="プレビュー操作メニュー"
                onClick={() => {
                  setIsCharacterMenuOpen((isOpen) => !isOpen);
                  setIsClearConfirming(false);
                }}
              >
                <Image src="/assets/character.svg" alt="" width={42} height={42} aria-hidden="true" />
              </button>
              {isCharacterMenuOpen ? (
                <div className="character-menu" role="menu">
                  {pdfBytes ? (
                    isClearConfirming ? (
                      <>
                        <p>読み込んだPDFをクリアしますか？</p>
                        <div className="character-menu-actions">
                          <button type="button" onClick={resetLoadedPdf}>クリア</button>
                          <button type="button" onClick={() => setIsClearConfirming(false)}>戻る</button>
                        </div>
                      </>
                    ) : (
                      <button type="button" role="menuitem" onClick={() => setIsClearConfirming(true)}>
                        読み込んだPDFをクリア
                      </button>
                    )
                  ) : (
                    <p className="character-hint">まずはPDFを読み込んでね。</p>
                  )}
                </div>
              ) : null}
            </div>
            {isRendering ? (
              <div className="preview-loader" role="status" aria-live="polite">
                <span aria-hidden="true" />
                読み込み中
              </div>
            ) : null}
            {pdfBytes ? (
              <div className="canvas-frame">
                <canvas ref={canvasRef} aria-label="PDFプレビュー" />
                {previewPage ? <div className={`split-marker ${direction}`} style={markerStyle} aria-hidden="true" /> : null}
              </div>
            ) : (
              <label
                className={`empty-preview${isDragging ? " is-dragging" : ""}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} />
                <span>{isDragging ? "ここにPDFをドロップ" : "PDFを選択 / ドロップ"}</span>
                <strong>見開きPDFをアップロードすると、ここにプレビューが表示されます</strong>
              </label>
            )}
          </div>
          <div className="preview-footer">
            <div className="preview-meta">
              {pageLabel ? <h2>{pageLabel}</h2> : null}
              <p className="preview-note">PDFはブラウザ内で処理され、サーバーには送信されません。</p>
            </div>
          </div>
        </div>
      </section>

    </SiteFrame>
  );
}

function getSplitParts(
  width: number,
  height: number,
  direction: SplitDirection,
  splitRatio: number,
  outputOrder: OutputOrder
): Rect[] {
  const ratio = splitRatio / 100;

  const parts =
    direction === "vertical"
      ? [
          { x: 0, y: 0, width: width * ratio, height },
          { x: width * ratio, y: 0, width: width * (1 - ratio), height }
        ]
      : [
          { x: 0, y: height * (1 - ratio), width, height: height * ratio },
          { x: 0, y: 0, width, height: height * (1 - ratio) }
        ];

  return outputOrder === "natural" ? parts : parts.reverse();
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function snapToCenter(value: number) {
  return Math.abs(value - 50) <= 1.5 ? 50 : value;
}

function normalizeRotation(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function getVisualSize(cropBox: Rect, rotation: number) {
  return rotation === 90 || rotation === 270
    ? { width: cropBox.height, height: cropBox.width }
    : { width: cropBox.width, height: cropBox.height };
}

function mapVisualRectToPageBox(rect: Rect, cropBox: Rect, rotation: number): Rect {
  switch (rotation) {
    case 90:
      return {
        x: cropBox.x + rect.y,
        y: cropBox.y + rect.x,
        width: rect.height,
        height: rect.width
      };
    case 180:
      return {
        x: cropBox.x + cropBox.width - rect.x - rect.width,
        y: cropBox.y + cropBox.height - rect.y - rect.height,
        width: rect.width,
        height: rect.height
      };
    case 270:
      return {
        x: cropBox.x + cropBox.width - rect.y - rect.height,
        y: cropBox.y + cropBox.height - rect.x - rect.width,
        width: rect.height,
        height: rect.width
      };
    default:
      return {
        x: cropBox.x + rect.x,
        y: cropBox.y + rect.y,
        width: rect.width,
        height: rect.height
      };
  }
}

function buildOutputFileName(fileName: string | undefined) {
  if (!fileName) {
    return "split.pdf";
  }

  return `${fileName.replace(/\.pdf$/i, "")}-split.pdf`;
}
