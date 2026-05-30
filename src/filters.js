const KERNEL_PRESETS = {
  identity: {
    name: "Тождественное отображение",
    values: [0, 0, 0, 0, 1, 0, 0, 0, 0],
    divisor: 1,
    offset: 0,
  },
  sharpen: {
    name: "Повышение резкости",
    values: [0, -1, 0, -1, 5, -1, 0, -1, 0],
    divisor: 1,
    offset: 0,
  },
  gaussian: {
    name: "Фильтр Гаусса 3×3",
    values: [1, 2, 1, 2, 4, 2, 1, 2, 1],
    divisor: 16,
    offset: 0,
  },
  boxBlur: {
    name: "Прямоугольное размытие",
    values: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    divisor: 9,
    offset: 0,
  },
  prewittX: {
    name: "Оператор Прюитта X",
    values: [-1, 0, 1, -1, 0, 1, -1, 0, 1],
    divisor: 1,
    offset: 128,
  },
  prewittY: {
    name: "Оператор Прюитта Y",
    values: [-1, -1, -1, 0, 0, 0, 1, 1, 1],
    divisor: 1,
    offset: 128,
  },
};

const CHANNEL_OFFSETS = {
  r: 0,
  g: 1,
  b: 2,
  a: 3,
};

function clamp(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function readEdgePixel(source, width, height, x, y, channelOffset, edgeMode) {
  if (x >= 0 && x < width && y >= 0 && y < height) {
    return source[(y * width + x) * 4 + channelOffset];
  }

  if (edgeMode === "black") return 0;
  if (edgeMode === "white") return 255;

  const safeX = Math.min(width - 1, Math.max(0, x));
  const safeY = Math.min(height - 1, Math.max(0, y));
  return source[(safeY * width + safeX) * 4 + channelOffset];
}

function parseKernel(inputEls) {
  return inputEls.map((input) => {
    const value = Number(String(input.value).replace(",", "."));
    return Number.isFinite(value) ? value : 0;
  });
}

function getSelectedChannels(channelCheckboxes) {
  return channelCheckboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

async function convolveImageData({ imageData, kernel, channels, edgeMode, onProgress }) {
  const { width, height } = imageData;
  const source = imageData.data;
  const output = new ImageData(new Uint8ClampedArray(source), width, height);
  const target = output.data;

  let divisor = kernel.reduce((sum, value) => sum + value, 0);
  if (divisor === 0) divisor = 1;

  const channelOffsets = channels.map((channel) => CHANNEL_OFFSETS[channel]);
  const chunkRows = 24;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;

      for (const channelOffset of channelOffsets) {
        let sum = 0;
        let kernelIndex = 0;

        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const pixelValue = readEdgePixel(
              source,
              width,
              height,
              x + kx,
              y + ky,
              channelOffset,
              edgeMode
            );

            sum += pixelValue * kernel[kernelIndex];
            kernelIndex += 1;
          }
        }

        target[pixelIndex + channelOffset] = clamp(sum / divisor);
      }
    }

    if (y % chunkRows === 0) {
      onProgress?.(Math.round((y / height) * 100));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  onProgress?.(100);
  return output;
}

export function initFiltersTool({
  getImageData,
  renderImageData,
  commitImageData,
  getAvailableChannels = () => ["r", "g", "b", "a"],
}) {
  const dialog = document.getElementById("filtersDialog");
  const openBtn = document.getElementById("openFiltersBtn");
  const closeX = document.getElementById("filtersCancelX");
  const cancelBtn = document.getElementById("filtersCancelBtn");
  const resetBtn = document.getElementById("filtersResetBtn");
  const applyBtn = document.getElementById("filtersApplyBtn");
  const previewCheckbox = document.getElementById("filtersPreview");
  const presetSelect = document.getElementById("filterPreset");
  const edgeSelect = document.getElementById("filterEdgeMode");
  const kernelInputs = Array.from(document.querySelectorAll(".kernel-input"));
  const channelCheckboxes = Array.from(document.querySelectorAll(".filter-channel"));
  const statusEl = document.getElementById("filtersStatus");
  const previewCanvas = document.getElementById("filtersPreviewCanvas");
  const previewCtx = previewCanvas?.getContext("2d");

  let baseImageData = null;
  let previewTimer = null;
  let isProcessing = false;
  let previewRenderToken = 0;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function drawPreviewCanvas(imageData) {
    if (!previewCanvas || !previewCtx || !imageData) return;

    const maxWidth = 260;
    const maxHeight = 220;
    const scale = Math.min(1, maxWidth / imageData.width, maxHeight / imageData.height);
    const previewWidth = Math.max(1, Math.round(imageData.width * scale));
    const previewHeight = Math.max(1, Math.round(imageData.height * scale));

    previewCanvas.width = previewWidth;
    previewCanvas.height = previewHeight;

    previewCtx.clearRect(0, 0, previewWidth, previewHeight);
    previewCtx.imageSmoothingEnabled = true;

    // Надёжный способ отрисовки предпросмотра:
    // сначала кладём ImageData на временный canvas в полном размере,
    // затем масштабируем его в маленький canvas предпросмотра.
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;

    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(imageData, 0, 0);

    previewCtx.drawImage(tempCanvas, 0, 0, previewWidth, previewHeight);
  }

  function fillKernel(values) {
    kernelInputs.forEach((input, index) => {
      input.value = values[index];
    });
  }

  function loadPreset(key) {
    const preset = KERNEL_PRESETS[key] ?? KERNEL_PRESETS.identity;
    fillKernel(preset.values);
    setStatus(`Выбрано: ${preset.name}`);
  }

  function isAlphaAvailable() {
    const channels = getAvailableChannels?.() ?? [];
    return Array.isArray(channels) && channels.includes("a");
  }

  function updateChannelAvailability() {
    const alphaAvailable = isAlphaAvailable();
    const grayMode = isGrayImage();

    channelCheckboxes.forEach((checkbox) => {
      const label = checkbox.closest("label");
      const value = checkbox.value;

      if (grayMode) {
        const visible =
          value === "gray" ||
          (value === "a" && alphaAvailable);

        checkbox.checked = visible;
        checkbox.disabled = !visible;

        if (label) label.hidden = !visible;
        return;
      }

      if (value === "gray") {
        checkbox.checked = false;
        checkbox.disabled = true;
        if (label) label.hidden = true;
        return;
      }

      if (value === "a") {
        checkbox.checked = alphaAvailable;
        checkbox.disabled = !alphaAvailable;
        if (label) label.hidden = !alphaAvailable;
        return;
      }

      checkbox.checked = true;
      checkbox.disabled = false;
      if (label) label.hidden = false;
    });
  }

  function isGrayImage() {
    const format = window.currentImageFormat || "";
    return format === "gb7";
  }

  function resetDialog() {
    presetSelect.value = "identity";
    edgeSelect.value = "copy";
    updateChannelAvailability();
    previewCheckbox.checked = true;
    loadPreset("identity");
  }

  async function buildFilteredImage() {
    if (!baseImageData || isProcessing) return null;

    const channels = getSelectedChannels(channelCheckboxes);
    if (channels.length === 0) {
      alert("Выберите хотя бы один канал.");
      return null;
    }

    isProcessing = true;
    applyBtn.disabled = true;
    resetBtn.disabled = true;
    setStatus("Обработка: 0%");

    try {
      return await convolveImageData({
        imageData: baseImageData,
        kernel: parseKernel(kernelInputs),
        channels,
        edgeMode: edgeSelect.value,
        onProgress: (progress) => setStatus(`Обработка: ${progress}%`),
      });
    } finally {
      isProcessing = false;
      applyBtn.disabled = false;
      resetBtn.disabled = false;
    }
  }

  function schedulePreview() {
    clearTimeout(previewTimer);

    if (!baseImageData) return;

    if (!previewCheckbox.checked) {
      drawPreviewCanvas(baseImageData);
      setStatus("Предпросмотр выключен");
      return;
    }

    previewTimer = setTimeout(async () => {
      const filtered = await buildFilteredImage();
      if (filtered && previewCheckbox.checked) {
        drawPreviewCanvas(filtered);
        setStatus("Предпросмотр обновлён");
      }
    }, 180);
  }

  openBtn?.addEventListener("click", () => {
    const current = getImageData();

    if (!current) {
      alert("Сначала загрузите изображение.");
      return;
    }

    baseImageData = new ImageData(
      new Uint8ClampedArray(current.data),
      current.width,
      current.height
    );

    resetDialog();
    drawPreviewCanvas(baseImageData);
    dialog.showModal();
    schedulePreview();
  });

  presetSelect?.addEventListener("change", () => {
    loadPreset(presetSelect.value);
    schedulePreview();
  });

  [...kernelInputs, edgeSelect, previewCheckbox, ...channelCheckboxes].forEach((control) => {
    control?.addEventListener("input", schedulePreview);
    control?.addEventListener("change", schedulePreview);
  });

  resetBtn?.addEventListener("click", () => {
    resetDialog();
    drawPreviewCanvas(baseImageData);
  });

  cancelBtn?.addEventListener("click", () => {
    dialog.close();
  });

  closeX?.addEventListener("click", () => {
    dialog.close();
  });

  applyBtn?.addEventListener("click", async () => {
    const filtered = await buildFilteredImage();

    if (!filtered) return;

    commitImageData(filtered);
    setStatus("Фильтр применён");
    dialog.close();
  });

  dialog?.addEventListener("close", () => {
    clearTimeout(previewTimer);
  });
}
