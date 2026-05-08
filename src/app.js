import { encodeGB7, decodeGB7 } from "./gb7.js";
import { replaceExtension } from "./utils.js";

const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const channelsList = document.getElementById("channelsList");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const channelState = {
  r: true,
  g: true,
  b: true,
  a: true,
};

let originalImageData = null;

const downloadPngBtn = document.getElementById("downloadPngBtn");
const downloadJpgBtn = document.getElementById("downloadJpgBtn");
const downloadGb7Btn = document.getElementById("downloadGb7Btn");
const maskCheckbox = document.getElementById("maskCheckbox");
const emptyState = document.getElementById("emptyState");
const toolButtons = document.querySelectorAll(".tool-button");

const fileNameEl = document.getElementById("fileName");
const fileFormatEl = document.getElementById("fileFormat");
const imageSizeEl = document.getElementById("imageSize");
const colorDepthEl = document.getElementById("colorDepth");
const maskInfoEl = document.getElementById("maskInfo");
const statusTextEl = document.getElementById("statusText");
const pixelPositionEl = document.getElementById("pixelPosition");
const pixelRgbaEl = document.getElementById("pixelRgba");
const pixelHexEl = document.getElementById("pixelHex");
const colorPreviewEl = document.getElementById("colorPreview");

const state = {
  fileName: "",
  format: "",
  width: 0,
  height: 0,
  colorDepth: "",
  hasMask: false,
  imageData: null,
  activeTool: "cursor",
};

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function exportCanvasImage(type, quality = 0.92) {
  if (!state.imageData) {
    alert("Сначала загрузите изображение.");
    return;
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      alert("Не удалось сформировать файл.");
      return;
    }

    const extension = type === "image/png" ? "png" : "jpg";
    const fileName = replaceExtension(state.fileName || "image", extension);

    downloadBlob(blob, fileName);
  }, type, quality);
}

function setActiveTool(tool) {
  state.activeTool = tool;

  toolButtons.forEach((button) => {
    button.classList.toggle("tool-button--active", button.dataset.tool === tool);
  });

  canvas.classList.toggle("tool-eyedropper", tool === "eyedropper");
  canvas.classList.toggle("tool-cursor", tool === "cursor");

  statusTextEl.textContent = tool === "eyedropper"
    ? "Инструмент: пипетка. Кликните по изображению, чтобы выбрать цвет."
    : getImageStatusText();
}

function getImageStatusText() {
  if (!state.width || !state.height) {
    return "Нет загруженного изображения";
  }

  return `Ширина: ${state.width}px | Высота: ${state.height}px | Глубина цвета: ${state.colorDepth}`;
}

function renderImageData(imageData) {
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.style.display = "block";
  emptyState.style.display = "none";

  ctx.putImageData(imageData, 0, 0);

  state.width = imageData.width;
  state.height = imageData.height;
  state.imageData = imageData;

  updateInfoPanel();
  resetPixelInfo();
}

function updateInfoPanel() {
  fileNameEl.textContent = state.fileName || "—";
  fileFormatEl.textContent = state.format || "—";
  imageSizeEl.textContent = state.width && state.height ? `${state.width} × ${state.height}` : "—";
  colorDepthEl.textContent = state.colorDepth || "—";
  maskInfoEl.textContent = state.hasMask ? "есть" : "нет";
  statusTextEl.textContent = getImageStatusText();
}

async function loadStandardImage(file) {
  const bitmap = await createImageBitmap(file);

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  updateChannelPreviews();
  applyChannels();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  state.fileName = file.name;
  state.format = file.type.includes("png") ? "PNG" : "JPG";
  state.colorDepth = "32 бит (RGBA)";
  state.hasMask = hasAnyTransparency(imageData);

  renderImageData(imageData);
}

function hasAnyTransparency(imageData) {
  const data = imageData.data;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) {
      return true;
    }
  }

  return false;
}

async function loadGB7(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = decodeGB7(arrayBuffer);

  state.fileName = file.name;
  state.format = "GB7";
  state.colorDepth = result.hasMask ? "8 бит (7 Gray + 1 mask)" : "7 бит (Gray)";
  state.hasMask = result.hasMask;

  renderImageData(result.imageData);
}

function componentToHex(value) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function rgbaToHex(r, g, b) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function resetPixelInfo() {
  pixelPositionEl.textContent = "—";
  pixelRgbaEl.textContent = "—";
  pixelHexEl.textContent = "—";
  colorPreviewEl.style.background = "";
}

function pickPixel(event) {
  if (state.activeTool !== "eyedropper" || !state.imageData) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor((event.clientX - rect.left) * scaleX);
  const y = Math.floor((event.clientY - rect.top) * scaleY);

  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }

  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const [r, g, b, a] = pixel;
  const hex = rgbaToHex(r, g, b);

  pixelPositionEl.textContent = `${x}, ${y}`;
  pixelRgbaEl.textContent = `${r}, ${g}, ${b}, ${a}`;
  pixelHexEl.textContent = hex;
  colorPreviewEl.style.background = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  statusTextEl.textContent = `Пипетка: x=${x}, y=${y}, RGBA(${r}, ${g}, ${b}, ${a})`;
}

downloadPngBtn.addEventListener("click", () => exportCanvasImage("image/png"));
downloadJpgBtn.addEventListener("click", () => exportCanvasImage("image/jpeg", 0.92));

downloadGb7Btn.addEventListener("click", () => {
  if (!state.imageData) {
    alert("Сначала загрузите изображение.");
    return;
  }

  const includeMask = maskCheckbox.checked;
  const blob = encodeGB7(state.imageData, includeMask);
  const fileName = replaceExtension(state.fileName || "image", "gb7");

  downloadBlob(blob, fileName);
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTool(button.dataset.tool));
});

canvas.addEventListener("click", pickPixel);

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".gb7")) {
      await loadGB7(file);
    } else if (
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg")
    ) {
      await loadStandardImage(file);
    } else {
      alert("Поддерживаются только PNG, JPG, JPEG и GB7.");
    }
  } catch (error) {
    console.error(error);
    alert(`Ошибка загрузки файла: ${error.message}`);
  } finally {
    fileInput.value = "";
  }
});



updateInfoPanel();
setActiveTool("cursor");


channelsList?.addEventListener("click", (event) => {
    originalImageData.width,
    originalImageData.height

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (!channelState.r) data[i] = 0;
    if (!channelState.g) data[i + 1] = 0;
    if (!channelState.b) data[i + 2] = 0;

    if (!channelState.a) {
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
});

function updateChannelPreviews() {
  if (!originalImageData) return;

  createChannelPreview("r", 0);
  createChannelPreview("g", 1);
  createChannelPreview("b", 2);
  createChannelPreview("a", 3, true);
}

function createChannelPreview(channel, offset, grayscale = false) {
  const previewCanvas = document.getElementById(`preview-${channel}`);

  if (!previewCanvas) return;

  const previewCtx = previewCanvas.getContext("2d");

  const preview = new ImageData(
    new Uint8ClampedArray(originalImageData.data),
    originalImageData.width,
    originalImageData.height
  );

  const data = preview.data;

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i + offset];

    if (grayscale) {
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
      continue;
    }

    data[i] = offset === 0 ? value : 0;
    data[i + 1] = offset === 1 ? value : 0;
    data[i + 2] = offset === 2 ? value : 0;
    data[i + 3] = 255;
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = originalImageData.width;
  tempCanvas.height = originalImageData.height;

  tempCanvas.getContext("2d").putImageData(preview, 0, 0);

  previewCtx.clearRect(0, 0, 48, 48);
  previewCtx.drawImage(tempCanvas, 0, 0, 48, 48);
}