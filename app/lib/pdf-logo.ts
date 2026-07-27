"use client";

const MAX_LOGO_DIMENSION = 1600;

export async function convertPdfLogoToPng(file: File): Promise<File> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const document = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const page = await document.getPage(1);
  const originalViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(
    2,
    MAX_LOGO_DIMENSION /
      Math.max(originalViewport.width, originalViewport.height)
  );
  const viewport = page.getViewport({ scale });
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The PDF logo could not be rendered.");

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error("The PDF logo could not be converted.")),
      "image/png"
    );
  });
  const baseName = file.name.replace(/\.pdf$/i, "") || "school-logo";
  return new File([blob], `${baseName}.png`, { type: "image/png" });
}
