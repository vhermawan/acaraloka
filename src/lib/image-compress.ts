export type PreparedImage = { blob: Blob; width: number; height: number; contentType: string };

const QUALITY_STEPS = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5];
const SCALE_STEP = 0.85;

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function readImageSize(file: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

export async function compressImage(
  file: File,
  limits: { maxBytes: number; minWidth: number },
): Promise<PreparedImage | null> {
  const bitmap = await createImageBitmap(file);
  try {
    if (file.size <= limits.maxBytes) {
      return { blob: file, width: bitmap.width, height: bitmap.height, contentType: file.type };
    }
    const floor = Math.min(1, limits.minWidth / bitmap.width);
    let scale = 1;
    for (;;) {
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      for (const quality of QUALITY_STEPS) {
        const blob = await encode(canvas, quality);
        if (blob && blob.size <= limits.maxBytes) return { blob, width, height, contentType: "image/jpeg" };
      }
      if (scale <= floor) return null;
      scale = Math.max(floor, scale * SCALE_STEP);
    }
  } finally {
    bitmap.close();
  }
}
