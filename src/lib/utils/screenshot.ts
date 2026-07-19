import * as THREE from 'three';

/**
 * captureScreenshot — downloads the current WebGL canvas as a PNG file.
 *
 * Must be called from inside a Canvas (useThree gives you `gl`),
 * or directly after a gl.render() call.
 *
 * @param gl - The THREE.WebGLRenderer from useThree()
 * @param filename - Download filename (default 'screenshot.png')
 */
export function captureScreenshot(
    gl: THREE.WebGLRenderer,
    filename = `screenshot-${Date.now()}.png`
): void {
    if (typeof window === 'undefined') return;

    // R3F renders to an offscreen buffer; preserve the last frame
    gl.domElement.toBlob(
        (blob) => {
            if (!blob) {
                console.warn('[screenshot] canvas toBlob returned null');
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        'image/png'
    );
}

/**
 * compareScreenshots — pixel-level diff between a reference image file path
 * and a Blob captured from the canvas.
 *
 * Returns a number 0–100 representing the **percentage of matching pixels**.
 * (100 = identical, 0 = completely different)
 *
 * This is the Phase 8 comparison utility in the render workflow.
 */
export async function compareScreenshots(
    referenceImageSrc: string,
    capturedBlob: Blob
): Promise<number> {
    if (typeof window === 'undefined') return 0;

    // Load both images onto off-screen canvases
    const [refData, capData] = await Promise.all([
        loadImageData(referenceImageSrc),
        blobToImageData(capturedBlob),
    ]);

    // Normalise to the smaller of the two dimensions
    const w = Math.min(refData.width, capData.width);
    const h = Math.min(refData.height, capData.height);

    let matchingPixels = 0;
    const totalPixels = w * h;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const dr = Math.abs(refData.data[i]     - capData.data[i]);
            const dg = Math.abs(refData.data[i + 1] - capData.data[i + 1]);
            const db = Math.abs(refData.data[i + 2] - capData.data[i + 2]);
            const avgDiff = (dr + dg + db) / 3;
            // Threshold of 15/255 ≈ 6% tolerance per channel
            if (avgDiff < 15) matchingPixels++;
        }
    }

    return Math.round((matchingPixels / totalPixels) * 100);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadImageData(src: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (!src.startsWith('blob:') && !src.startsWith('data:')) {
            img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        };
        img.onerror = reject;
        img.src = src;
    });
}

async function blobToImageData(blob: Blob): Promise<ImageData> {
    const url = URL.createObjectURL(blob);
    try {
        const data = await loadImageData(url);
        URL.revokeObjectURL(url);
        return data;
    } catch (err) {
        URL.revokeObjectURL(url);
        throw err;
    }
}
