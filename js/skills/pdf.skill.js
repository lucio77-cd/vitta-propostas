// SKILL: PDF — leitura e renderização de páginas (pdf.js carregado sob demanda) e base64.
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let loader = null;
function loadPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS_URL;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => { loader = null; reject(new Error("Não foi possível carregar o leitor de PDF.")); };
    document.head.appendChild(s);
  });
  return loader;
}

const tasks = new WeakMap(); // canvas -> renderização em andamento

export const PdfSkill = {
  /** Abre um PDF a partir de bytes (Uint8Array). Usa uma cópia, pois o pdf.js consome o buffer. */
  async open(bytes) {
    const lib = await loadPdfjs();
    return lib.getDocument({ data: bytes.slice() }).promise;
  },

  /** Tamanho de cada página em pontos PDF (1 pt = 1/72 pol). */
  async pageSizes(pdf) {
    const out = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const v = (await pdf.getPage(n)).getViewport({ scale: 1 });
      out.push({ w: Math.round(v.width * 100) / 100, h: Math.round(v.height * 100) / 100 });
    }
    return out;
  },

  /** Desenha a página n no canvas, na largura (px CSS) indicada. */
  async renderPage(pdf, n, canvas, width) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = width / base.width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale: scale * dpr });

    tasks.get(canvas)?.cancel();
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${base.height * scale}px`;

    const task = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
    tasks.set(canvas, task);
    try {
      await task.promise;
    } catch (e) {
      if (e?.name !== "RenderingCancelledException") throw e;
    }
    return { width, height: base.height * scale };
  },

  toBase64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  },

  fromBase64(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
};
