"use client";

import Image from "next/image";
import SiteFrame from "./site-frame";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { EncryptedPDFError, PDFDocument } from "pdf-lib";
import type { PDFPageProxy } from "pdfjs-dist";
import JSZip from "jszip";

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

type BatchItemResult = {
  name: string;
  status: "waiting" | "processing" | "complete" | "error";
  message?: string;
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

async function loadPreviewDocument(bytes: ArrayBuffer, password: string) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  return pdfjs.getDocument({ data: bytes.slice(0), password: password || undefined }).promise;
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
  const [files, setFiles] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<BatchItemResult[]>([]);
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
  const [password, setPassword] = useState("");
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [submittedPassword, setSubmittedPassword] = useState("");
  const [passwordsByFile, setPasswordsByFile] = useState<Record<string, string>>({});

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
        const pdf = await loadPreviewDocument(bytes, submittedPassword);

        if (cancelled) {
          return;
        }

        setPageCount(pdf.numPages);
        setPreviewPageNumber(1);
        setIsPasswordRequired(false);
      } catch (previewError) {
        console.error(previewError);
        if (isPasswordError(previewError)) {
          setIsPasswordRequired(true);
          setError(submittedPassword ? "パスワードが違います。もう一度入力してください。" : null);
        } else {
          setIsPasswordRequired(false);
          setError("PDFのプレビュー生成に失敗しました。別のPDFで試してください。");
        }
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
  }, [pdfBytes, submittedPassword]);

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
        const pdf = await loadPreviewDocument(bytes, submittedPassword);
        const page = await pdf.getPage(previewPageNumber);

        if (cancelled) {
          return;
        }

        setPreviewPage(getPageSize(page));
        await drawPage(canvasRef.current, page);
      } catch (previewError) {
        console.error(previewError);
        if (isPasswordError(previewError)) {
          setIsPasswordRequired(true);
          setError(submittedPassword ? "パスワードが違います。もう一度入力してください。" : null);
        } else {
          setError("PDFのプレビュー生成に失敗しました。別のPDFで試してください。");
        }
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
  }, [pdfBytes, previewPageNumber, submittedPassword]);


  async function loadPdfFile(selectedFile: File | null) {
    setFile(selectedFile);
    setPreviewPage(null);
    setPreviewPageNumber(1);
    setPageCount(0);
    setError(null);
    const savedPassword = selectedFile ? passwordsByFile[getFileKey(selectedFile)] ?? "" : "";
    setPassword("");
    setIsPasswordRequired(false);
    setSubmittedPassword(savedPassword);
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

  async function loadPdfFiles(selectedFiles: FileList | File[]) {
    const nextFiles = Array.from(selectedFiles);

    if (nextFiles.length === 0) {
      return;
    }

    const invalidFile = nextFiles.find(
      (candidate) => candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")
    );

    if (invalidFile) {
      setError("PDFファイルのみ選択してください。");
      return;
    }

    setFiles(nextFiles);
    setBatchResults(nextFiles.map(({ name }) => ({ name, status: "waiting" })));
    await loadPdfFile(nextFiles[0]);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      await loadPdfFiles(event.target.files);
    }
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
    await loadPdfFiles(event.dataTransfer.files);
  }
  function goToPreviousPage() {
    setPreviewPageNumber((currentPage) => Math.max(1, currentPage - 1));
  }

  function goToNextPage() {
    setPreviewPageNumber((currentPage) => Math.min(pageCount, currentPage + 1));
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      return;
    }

    setError(null);
    setSubmittedPassword(password);
    if (file) {
      setPasswordsByFile((current) => ({ ...current, [getFileKey(file)]: password }));
    }
  }

  async function createSplitPdf(bytes: ArrayBuffer, currentPassword = "") {
    try {
      return await splitPdfWithPageBoxes(bytes, direction, splitRatio, outputOrder);
    } catch (splitError) {
      if (!(splitError instanceof EncryptedPDFError)) {
        throw splitError;
      }

      return splitEncryptedPdfAsImages(bytes, currentPassword, direction, splitRatio, outputOrder);
    }
  }

  async function handleDownload() {
    if (files.length === 0) {
      setError("分割するPDFを選択してください。");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const zip = new JSZip();
      let successCount = 0;

      for (let index = 0; index < files.length; index += 1) {
        const processingFile = files[index];
        setBatchResults((current) => current.map((item, itemIndex) => (
          itemIndex === index ? { ...item, status: "processing", message: "分割中" } : item
        )));

        try {
          const bytes = processingFile === file && pdfBytes ? pdfBytes : await processingFile.arrayBuffer();
          const currentPassword = passwordsByFile[getFileKey(processingFile)] ?? "";
          const outputBytes = await createSplitPdf(bytes, currentPassword);
          zip.file(buildOutputFileName(processingFile.name), outputBytes);
          successCount += 1;
          setBatchResults((current) => current.map((item, itemIndex) => (
            itemIndex === index ? { ...item, status: "complete", message: "完了" } : item
          )));
        } catch (processingError) {
          console.error(processingError);
          const message = isPasswordError(processingError)
            ? "パスワードが必要です。対象ファイルを選んでから開いてください。"
            : "分割に失敗しました";
          setBatchResults((current) => current.map((item, itemIndex) => (
            itemIndex === index ? { ...item, status: "error", message } : item
          )));
        }
      }

      if (successCount === 0) {
        setError("分割できるPDFがありませんでした。エラー内容を確認してください。");
        return;
      }

      const archive = await zip.generateAsync({ type: "blob" });
      const blob = archive;
      const nextUrl = URL.createObjectURL(blob);

      setDownloadUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return nextUrl;
      });
    } catch (processingError) {
      console.error(processingError);
      setError("ZIPファイルの作成に失敗しました。もう一度試してください。");
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
    setFiles([]);
    setBatchResults([]);
    setPdfBytes(null);
    setPageCount(0);
    setPreviewPageNumber(1);
    setPreviewPage(null);
    setDownloadUrl(null);
    setError(null);
    setPassword("");
    setIsPasswordRequired(false);
    setSubmittedPassword("");
    setPasswordsByFile({});
    setIsProcessing(false);
    clearCanvas(canvasRef.current);
    closeCharacterMenu();
  }

  async function removePdfFile(fileToRemove: File) {
    if (isProcessing) {
      return;
    }

    const remainingFiles = files.filter((candidate) => candidate !== fileToRemove);
    const isRemovingSelectedFile = fileToRemove === file;

    setFiles(remainingFiles);
    setBatchResults((current) => current.filter((_, index) => files[index] !== fileToRemove));

    if (remainingFiles.length === 0) {
      resetLoadedPdf();
      return;
    }

    if (isRemovingSelectedFile) {
      await loadPdfFile(remainingFiles[0]);
    }
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
            <input type="file" accept="application/pdf,.pdf" multiple onChange={handleFileChange} />
            <span>{isDragging ? "ここにPDFをドロップ" : "PDFを複数選択 / ドロップ"}</span>
            <strong>{files.length > 0 ? `${files.length}件を読み込みました` : "未選択"}</strong>
          </label>

          {files.length > 0 ? (
            <div className="batch-file-list" aria-label="読み込んだPDFの一覧">
              <div className="batch-file-list-header">
                <span className="field-label">処理するPDF</span>
                <div className="batch-file-list-actions">
                  <span>{files.length}件</span>
                  <button type="button" onClick={resetLoadedPdf} disabled={isProcessing}>
                    すべてクリア
                  </button>
                </div>
              </div>
              <div className="batch-file-list-items">
                {files.map((batchFile, index) => {
                  const result = batchResults[index];
                  const isSelected = batchFile === file;

                  return (
                    <div className="batch-file-row" key={`${batchFile.name}-${batchFile.lastModified}-${index}`}>
                      <button
                        className={`batch-file-item${isSelected ? " is-selected" : ""}`}
                        type="button"
                        onClick={() => loadPdfFile(batchFile)}
                        disabled={isProcessing}
                      >
                        <span className="batch-file-name">{batchFile.name}</span>
                        <span className={`batch-file-status is-${result?.status ?? "waiting"}`}>
                          {result?.message ?? "待機中"}
                        </span>
                      </button>
                      <button
                        className="batch-file-remove"
                        type="button"
                        onClick={() => removePdfFile(batchFile)}
                        disabled={isProcessing}
                        aria-label={`${batchFile.name}を削除`}
                        title="このファイルを削除"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isPasswordRequired ? (
            <form className="password-form" onSubmit={handlePasswordSubmit}>
              <label className="field-label" htmlFor="pdf-password">PDFのパスワード</label>
              <div className="password-input-row">
                <input
                  id="pdf-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  autoFocus
                />
                <button type="submit" disabled={!password || isRendering}>開く</button>
              </div>
              <p>パスワードはこのブラウザ内だけで使用し、保存・送信しません。</p>
            </form>
          ) : null}

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

          <button className="primary-button" type="button" onClick={handleDownload} disabled={files.length === 0 || isPasswordRequired || isProcessing}>
            {isProcessing ? "まとめて分割中..." : "まとめて分割してZIPを作成"}
          </button>

          {downloadUrl ? (
            <a className="download-link" href={downloadUrl} download="split-pdfs.zip">
              分割後PDFをZIPでダウンロード
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
            {pdfBytes && !isPasswordRequired ? (
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
                <input type="file" accept="application/pdf,.pdf" multiple onChange={handleFileChange} />
                <span>{isDragging ? "ここにPDFをドロップ" : "PDFを複数選択 / ドロップ"}</span>
                <strong>見開きPDFをアップロードすると、選択中のファイルをここにプレビュー表示します</strong>
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

async function splitPdfWithPageBoxes(
  bytes: ArrayBuffer,
  direction: SplitDirection,
  splitRatio: number,
  outputOrder: OutputOrder
) {
  const sourcePdf = await PDFDocument.load(bytes.slice(0));
  const outputPdf = await PDFDocument.create();

  for (let pageIndex = 0; pageIndex < sourcePdf.getPageCount(); pageIndex += 1) {
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

  return outputPdf.save();
}

async function splitEncryptedPdfAsImages(
  bytes: ArrayBuffer,
  password: string,
  direction: SplitDirection,
  splitRatio: number,
  outputOrder: OutputOrder
) {
  const sourcePdf = await loadPreviewDocument(bytes, password);
  const outputPdf = await PDFDocument.create();
  const renderScale = 2;

  for (let pageIndex = 1; pageIndex <= sourcePdf.numPages; pageIndex += 1) {
    const sourcePage = await sourcePdf.getPage(pageIndex);
    const pageViewport = sourcePage.getViewport({ scale: renderScale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas context is unavailable.");
    }

    canvas.width = Math.ceil(pageViewport.width);
    canvas.height = Math.ceil(pageViewport.height);
    await sourcePage.render({ canvasContext: context, viewport: pageViewport }).promise;

    const parts = getSplitParts(
      pageViewport.width / renderScale,
      pageViewport.height / renderScale,
      direction,
      splitRatio,
      outputOrder
    );

    for (const part of parts) {
      const partCanvas = document.createElement("canvas");
      partCanvas.width = Math.round(part.width * renderScale);
      partCanvas.height = Math.round(part.height * renderScale);
      const partContext = partCanvas.getContext("2d");

      if (!partContext) {
        throw new Error("Canvas context is unavailable.");
      }

      partContext.drawImage(
        canvas,
        Math.round(part.x * renderScale),
        Math.round(canvas.height - (part.y + part.height) * renderScale),
        partCanvas.width,
        partCanvas.height,
        0,
        0,
        partCanvas.width,
        partCanvas.height
      );
      const image = await outputPdf.embedPng(partCanvas.toDataURL("image/png"));
      const newPage = outputPdf.addPage([part.width, part.height]);
      newPage.drawImage(image, { x: 0, y: 0, width: part.width, height: part.height });
    }
  }

  return outputPdf.save();
}

function isPasswordError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "PasswordException";
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
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
