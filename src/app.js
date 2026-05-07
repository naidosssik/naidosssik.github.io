import { encodeGB7, decodeGB7 } from "./gb7.js";
import { clamp, replaceExtension } from "./utils.js";

const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const downloadPngBtn = document.getElementById("downloadPngBtn");
const downloadJpgBtn = document.getElementById("downloadJpgBtn");
const downloadGb7Btn = document.getElementById("downloadGb7Btn");
const maskCheckbox = document.getElementById("maskCheckbox");
const fileNameEl = document.getElementById("fileName");
const fileFormatEl = document.getElementById("fileFormat");
const imageSizeEl = document.getElementById("imageSize");
const colorDepthEl = document.getElementById("colorDepth");
const maskInfoEl = document.getElementById("maskInfo");
const statusTextEl = document.getElementById("statusText");
const channelPanelEl = document.getElementById("channelPanel");
const canvasPanel = document.querySelector(".canvas-panel");

const state = {
  fileName: "",
  format: "",
  width: 0,
  height: 0,
  colorDepth: "",
  hasMask: false,
  imageData: null,
  originalImageData: null, // Исходное изображение (для работы каналов)
  channels: {
    red: true,
    green: true,
    blue: true,
    alpha: true,
    gray: false // По умолчанию выключаем режим Grayscale, чтобы видеть RGB
  }
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
    if (!blob) return;
    const extension = type === "image/png" ? "png" : "jpg";
    const fileName = replaceExtension(state.fileName || "image", extension);
    downloadBlob(blob, fileName);
  }, type, quality);
}


function createChannelThumbnail(type, originalData) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = 40;
  tempCanvas.height = 40;
  const tCtx = tempCanvas.getContext("2d");
  
  const tempImgData = tCtx.createImageData(40, 40);
  const data = tempImgData.data;
  const src = originalData.data;
  const w = originalData.width;
  const h = originalData.height;

  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      // Маппинг координат миниатюры на оригинал
      const srcX = Math.floor((x / 40) * w);
      const srcY = Math.floor((y / 40) * h);
      const srcIdx = (srcY * w + srcX) * 4;
      const dstIdx = (y * 40 + x) * 4;

      const r = src[srcIdx];
      const g = src[srcIdx + 1];
      const b = src[srcIdx + 2];
      const a = src[srcIdx + 3];

      if (type === "red") {
        data[dstIdx] = r; data[dstIdx+1] = 0; data[dstIdx+2] = 0; data[dstIdx+3] = 255;
      } else if (type === "green") {
        data[dstIdx] = 0; data[dstIdx+1] = g; data[dstIdx+2] = 0; data[dstIdx+3] = 255;
      } else if (type === "blue") {
        data[dstIdx] = 0; data[dstIdx+1] = 0; data[dstIdx+2] = b; data[dstIdx+3] = 255;
      } else if (type === "alpha") {
        // Показываем альфа как белый цвет на черном фоне
        data[dstIdx] = a; data[dstIdx+1] = a; data[dstIdx+2] = a; data[dstIdx+3] = 255;
      } else if (type === "gray") {
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        data[dstIdx] = gray; data[dstIdx+1] = gray; data[dstIdx+2] = gray; data[dstIdx+3] = 255;
      }
    }
  }
  
  tCtx.putImageData(tempImgData, 0, 0);
  return tempCanvas.toDataURL();
}

function renderChannelPanel() {
  channelPanelEl.innerHTML = "";
  if (!state.originalImageData) return;

  const channels = [
    { id: "gray", label: "Grayscale", desc: "Яркость", cssClass: "gray" },
    { id: "red", label: "Red", desc: "Красный", cssClass: "r" },
    { id: "green", label: "Green", desc: "Зеленый", cssClass: "g" },
    { id: "blue", label: "Blue", desc: "Синий", cssClass: "b" },
    { id: "alpha", label: "Alpha", desc: "Прозрачность", cssClass: "a" }
  ];

  channels.forEach(ch => {
    const thumbUrl = createChannelThumbnail(ch.id, state.originalImageData);
    
    const div = document.createElement("div");
    div.className = `channel-item ${state.channels[ch.id] ? "active" : ""}`;
    div.onclick = () => toggleChannel(ch.id);

    div.innerHTML = `
      <img src="${thumbUrl}" class="channel-thumb" alt="${ch.label}">
      <div class="channel-info">
        <span class="channel-name ${ch.cssClass}">${ch.label}</span>
        <span class="channel-desc">${ch.desc}</span>
      </div>
    `;
    channelPanelEl.appendChild(div);
  });
}

function toggleChannel(id) {
  state.channels[id] = !state.channels[id];
  
  // Логика взаимодействия каналов:
  // Если включен Grayscale, он доминирует над RGB визуально.
  // Но мы позволяем комбинировать их для гибкости (например, Gray + Alpha).
  // Если нужно строго переключение режимов, логику можно усложнить, 
  // но сейчас оставим аддитивную модель с приоритетом Gray.

  renderChannelPanel();
  applyChannelsToCanvas();
}

function applyChannelsToCanvas() {
  if (!state.originalImageData) return;

  const src = state.originalImageData.data;
  const w = state.originalImageData.width;
  const h = state.originalImageData.height;
  
  // Создаем новый буфер для канваса
  const outputImageData = ctx.createImageData(w, h);
  const dst = outputImageData.data;

  const useGray = state.channels.gray;
  const showR = state.channels.red;
  const showG = state.channels.green;
  const showB = state.channels.blue;
  const showA = state.channels.alpha;

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const a = src[i + 3];

    let outR, outG, outB, outA;

    if (useGray) {
      // Если включен Gray, используем яркость
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      outR = gray;
      outG = gray;
      outB = gray;
    } else {
      outR = showR ? r : 0;
      outG = showG ? g : 0;
      outB = showB ? b : 0;
    }

    if (showA) {
      outA = a;
    } else {
      outA = 255; 
    }

    dst[i] = outR;
    dst[i + 1] = outG;
    dst[i + 2] = outB;
    dst[i + 3] = outA;
  }

  // Обновляем канвас
  ctx.putImageData(outputImageData, 0, 0);
  
  // Сохраняем текущее состояние как "imageData" для экспорта
  state.imageData = outputImageData;
  
  // Обновляем статус (опционально, можно добавить инфо о каналах)
  updateInfoPanel();
}

function updateInfoPanel() {
  fileNameEl.textContent = state.fileName || "—";
  fileFormatEl.textContent = state.format || "—";
  imageSizeEl.textContent = state.width && state.height ? `${state.width} × ${state.height}` : "—";
  colorDepthEl.textContent = state.colorDepth || "—";
  maskInfoEl.textContent = state.hasMask ? "есть" : "нет";
  
  // Статус бар
  const activeCh = [];
  if (state.channels.gray) activeCh.push("Gray");
  if (state.channels.red) activeCh.push("R");
  if (state.channels.green) activeCh.push("G");
  if (state.channels.blue) activeCh.push("B");
  if (state.channels.alpha) activeCh.push("A");
  
  statusTextEl.textContent = state.width 
    ? `Каналы: ${activeCh.join(", ")} | ${state.width}x${state.height}`
    : "Нет загруженного изображения";
}

async function loadStandardImage(file) {
  const bitmap = await createImageBitmap(file);
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  
  ctx.drawImage(bitmap, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  state.fileName = file.name;
  state.format = file.type.includes("png") ? "PNG" : "JPG";
  state.colorDepth = "32 бит (RGBA)";
  state.hasMask = hasAnyTransparency(imgData);
  state.width = bitmap.width;
  state.height = bitmap.height;

  state.originalImageData = imgData;
  
  // Сброс каналов в дефолт (RGB + Alpha)
  state.channels = { red: true, green: true, blue: true, alpha: true, gray: false };
  
  // UI
  if (file.type.includes("png")) {
    canvasPanel.classList.add("canvas-panel--checkerboard");
  } else {
    canvasPanel.classList.remove("canvas-panel--checkerboard");
  }

  renderChannelPanel();
  applyChannelsToCanvas();
}

async function loadGB7(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = decodeGB7(arrayBuffer);
  
  state.fileName = file.name;
  state.format = "GB7";
  state.colorDepth = result.hasMask ? "8 бит (7 Gray + 1 mask)" : "7 бит (Gray)";
  state.hasMask = result.hasMask;
  state.width = result.width;
  state.height = result.height;
  
  canvas.width = result.width;
  canvas.height = result.height;

  state.originalImageData = result.imageData;

  // Для GB7 логично включить Gray и Alpha по умолчанию, если есть маска
  state.channels = { 
    red: false, green: false, blue: false, 
    alpha: result.hasMask, 
    gray: true 
  };
  
  canvasPanel.classList.remove("canvas-panel--checkerboard");

  renderChannelPanel();
  applyChannelsToCanvas();
}

function hasAnyTransparency(imageData) {
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) return true;
  }
  return false;
}


fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".gb7")) await loadGB7(file);
    else if (lowerName.match(/\.(png|jpg|jpeg)$/)) await loadStandardImage(file);
    else alert("Поддерживаются PNG, JPG, JPEG и GB7.");
  } catch (error) {
    alert(`Ошибка: ${error.message}`);
  } finally {
    fileInput.value = "";
  }
});

downloadPngBtn.addEventListener("click", () => exportCanvasImage("image/png"));
downloadJpgBtn.addEventListener("click", () => exportCanvasImage("image/jpeg"));
downloadGb7Btn.addEventListener("click", () => {
  if (!state.imageData) return alert("Загрузите изображение");
  const blob = encodeGB7(state.imageData, maskCheckbox.checked);
  downloadBlob(blob, replaceExtension(state.fileName || "image", "gb7"));
});
