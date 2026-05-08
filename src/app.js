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

const state = {
  fileName: "",
  format: "",
  width: 0,
  height: 0,
  colorDepth: "",
  hasMask: false,
  imageData: null,

};



function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderImageData(imageData) {
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  ctx.putImageData(imageData, 0, 0);
  canvas.style.display = "block";

  state.width = imageData.width;
  state.height = imageData.height;
  state.imageData = imageData;
}


function updateInfoPanel() {
  fileNameEl.textContent = state.fileName || "—";
  fileFormatEl.textContent = state.format || "—";
  imageSizeEl.textContent =
    state.width && state.height ? `${state.width} × ${state.height}` : "—";
  colorDepthEl.textContent = state.colorDepth || "—";
  maskInfoEl.textContent = state.hasMask ? "есть" : "нет";

  if (state.width && state.height) {
    statusTextEl.textContent =
      `Ширина: ${state.width}px | Высота: ${state.height}px | Глубина цвета: ${state.colorDepth}`;
  } else {
    statusTextEl.textContent = "Нет загруженного изображения";
  }
}

async function loadStandardImage(file) {
  const bitmap = await createImageBitmap(file);

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  state.originalImageData = imageData;
  state.fileName = file.name;
  state.format = file.type.includes("png") ? "PNG" : "JPG";
  state.colorDepth = "32 бит (RGBA)";
  state.hasMask = hasAnyTransparency(imageData);
  

  renderImageData(imageData);
  updateInfoPanel();
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

  state.originalImageData = imageData;
  state.fileName = file.name;
  state.format = "GB7";
  state.colorDepth = result.hasMask ? "8 бит (7 Gray + 1 mask)" : "7 бит (Gray)";
  state.hasMask = result.hasMask;

  renderImageData(result.imageData);
  updateInfoPanel();
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

    const ext = type === "image/png" ? "png" : "jpg";
    const name = replaceExtension(state.fileName || "image", ext);
    downloadBlob(blob, name);
  }, type, quality);
}

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

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

downloadPngBtn.addEventListener("click", () => {
  exportCanvasImage("image/png");
});

downloadJpgBtn.addEventListener("click", () => {
  exportCanvasImage("image/jpeg", 0.92);
});

downloadGb7Btn.addEventListener("click", () => {
  if (!state.imageData) {
    alert("Сначала загрузите изображение.");
    return;
  }

  const blob = encodeGB7(state.imageData, maskCheckbox.checked);
  const fileName = replaceExtension(state.fileName || "image", "gb7");
  downloadBlob(blob, fileName);
});

updateInfoPanel();
