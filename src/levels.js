const DEFAULT_LEVEL = { black: 0, white: 255, gamma: 1 };
const DEFAULT_CHANNELS = ["master", "r", "g", "b"];
const CHANNEL_INDEX = { gray: 0, r: 0, g: 1, b: 2, a: 3 };
const CHANNEL_LABELS = {
  master: "Master",
  gray: "Gray",
  r: "Red",
  g: "Green",
  b: "Blue",
  a: "Alpha",
};

export function initLevelsTool({
  getImageData,
  renderImageData,
  commitImageData,
  getAvailableChannels = () => DEFAULT_CHANNELS,
}) {
  const openBtn = document.getElementById("openLevelsBtn");
  const dialog = document.getElementById("levelsDialog");
  const channelSelect = document.getElementById("levelsChannel");
  const histogramModeSelect = document.getElementById("histogramMode");
  const histogramCanvas = document.getElementById("histogramCanvas");
  const histogramCtx = histogramCanvas?.getContext("2d");
  const previewCanvas = document.getElementById("levelsPreviewCanvas");
  const previewCtx = previewCanvas?.getContext("2d");

  const blackInput = document.getElementById("blackInput");
  const whiteInput = document.getElementById("whiteInput");
  const gammaInput = document.getElementById("gammaInput");
  const blackValue = document.getElementById("blackValue");
  const whiteValue = document.getElementById("whiteValue");
  const gammaValue = document.getElementById("gammaValue");

  const previewCheckbox = document.getElementById("levelsPreview");
  const resetBtn = document.getElementById("levelsResetBtn");
  const cancelBtn = document.getElementById("levelsCancelBtn");
  const cancelX = document.getElementById("levelsCancelX");
  const applyBtn = document.getElementById("levelsApplyBtn");

  if (
    !openBtn ||
    !dialog ||
    !channelSelect ||
    !histogramCanvas ||
    !histogramCtx ||
    !previewCanvas ||
    !previewCtx
  ) {
    return;
  }

  let baseImageData = null;
  let settings = createDefaultSettings();
  let activeChannel = "master";
  let frameId = null;
  let applied = false;

  openBtn.addEventListener("click", () => {
    const current = getImageData();
    if (!current) {
      alert("Сначала загрузите изображение.");
      return;
    }

    baseImageData = cloneImageData(current);
    const availableChannels = normalizeChannels(getAvailableChannels());
    fillChannelSelect(availableChannels);
    settings = createDefaultSettings(availableChannels);
    activeChannel = availableChannels.includes("master") ? "master" : availableChannels[0];
    applied = false;

    channelSelect.value = activeChannel;
    histogramModeSelect.value = "linear";
    previewCheckbox.checked = true;

    syncControlsFromSettings();
    drawHistogram();
    drawLevelsPreview(baseImageData);
    dialog.showModal();
  });

  channelSelect.addEventListener("change", () => {
    saveControlsToSettings();
    activeChannel = channelSelect.value;
    syncControlsFromSettings();
    drawHistogram();
    schedulePreview();
  });

  histogramModeSelect.addEventListener("change", drawHistogram);

  [blackInput, whiteInput, gammaInput].forEach((input) => {
    input.addEventListener("input", () => {
      clampControls();
      saveControlsToSettings();
      updateLabels();
      schedulePreview();
    });
  });

  previewCheckbox.addEventListener("change", () => {
    if (previewCheckbox.checked) schedulePreview();
    else restoreBaseImage();
  });

  resetBtn.addEventListener("click", () => {
    settings = createDefaultSettings();
    syncControlsFromSettings();
    drawHistogram();
    schedulePreview();
  });

  cancelBtn.addEventListener("click", cancelLevels);
  cancelX.addEventListener("click", cancelLevels);

  applyBtn.addEventListener("click", () => {
    if (!baseImageData) return;
    saveControlsToSettings();
    const result = applyLevels(baseImageData, settings);
    applied = true;
    commitImageData(cloneImageData(result));
    dialog.close();
  });

  dialog.addEventListener("close", () => {
    if (!applied && baseImageData) restoreBaseImage();
    baseImageData = null;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = null;
  });

  function cancelLevels() {
    applied = false;
    dialog.close();
  }

  function createDefaultSettings(channels = normalizeChannels(getAvailableChannels())) {
    return Object.fromEntries(channels.map((channel) => [channel, { ...DEFAULT_LEVEL }]));
  }

  function normalizeChannels(channels) {
    const result = Array.isArray(channels) && channels.length
      ? channels
      : DEFAULT_CHANNELS;

    return result.includes("master") ? result : ["master", ...result];
  }

  function fillChannelSelect(channels) {
    channelSelect.innerHTML = channels
      .map((channel) => `<option value="${channel}">${CHANNEL_LABELS[channel] || channel}</option>`)
      .join("");
  }

  function syncControlsFromSettings() {
    const current = settings[activeChannel];
    blackInput.value = current.black;
    whiteInput.value = current.white;
    gammaInput.value = current.gamma;
    clampControls();
    updateLabels();
  }

  function saveControlsToSettings() {
    settings[activeChannel] = {
      black: Number(blackInput.value),
      white: Number(whiteInput.value),
      gamma: Number(gammaInput.value),
    };
  }

  function clampControls() {
    let black = Number(blackInput.value);
    let white = Number(whiteInput.value);
    let gamma = Number(gammaInput.value);

    black = Math.max(0, Math.min(254, black));
    white = Math.max(1, Math.min(255, white));

    if (black >= white) {
      if (document.activeElement === blackInput) black = white - 1;
      else white = black + 1;
    }

    gamma = Math.max(0.1, Math.min(9.9, gamma));

    blackInput.value = black;
    whiteInput.value = white;
    gammaInput.value = gamma.toFixed(1);
  }

  function updateLabels() {
    blackValue.textContent = blackInput.value;
    whiteValue.textContent = whiteInput.value;
    gammaValue.textContent = Number(gammaInput.value).toFixed(1);
  }

  function schedulePreview() {
    if (!baseImageData) return;

    if (frameId) cancelAnimationFrame(frameId);

    frameId = requestAnimationFrame(() => {
      const result = applyLevels(baseImageData, settings);

      drawLevelsPreview(result);

      if (previewCheckbox.checked) {
        renderImageData(result);
      }

      frameId = null;
    });
  }

  function restoreBaseImage() {
    if (!baseImageData) return;

    drawLevelsPreview(baseImageData);
    renderImageData(cloneImageData(baseImageData));
  }

  function drawLevelsPreview(imageData) {
    if (!imageData) return;

    previewCanvas.width = imageData.width;
    previewCanvas.height = imageData.height;

    previewCtx.putImageData(imageData, 0, 0);
  }

  function drawHistogram() {
    if (!baseImageData) return;

    const histogram = buildHistogram(baseImageData, activeChannel);
    const values = histogramModeSelect.value === "log"
      ? histogram.map((value) => Math.log10(value + 1))
      : histogram;

    const dpr = window.devicePixelRatio || 1;
    const rect = histogramCanvas.getBoundingClientRect();

    histogramCanvas.width = Math.round(rect.width * dpr);
    histogramCanvas.height = Math.round(rect.height * dpr);

    histogramCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = rect.width;
    const height = rect.height;
    const padding = 10;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    const maxValue = Math.max(...values, 1);
    const barWidth = graphWidth / 256;

    histogramCtx.clearRect(0, 0, width, height);
    histogramCtx.fillStyle = "#17191d";
    histogramCtx.fillRect(0, 0, width, height);

    histogramCtx.strokeStyle = "rgba(255,255,255,.16)";
    for (let i = 0; i <= 4; i += 1) {
      const y = padding + (graphHeight / 4) * i;
      histogramCtx.beginPath();
      histogramCtx.moveTo(padding, y);
      histogramCtx.lineTo(width - padding, y);
      histogramCtx.stroke();
    }

    histogramCtx.fillStyle = getHistogramColor(activeChannel);
    values.forEach((value, level) => {
      const barHeight = (value / maxValue) * graphHeight;
      const x = padding + level * barWidth;
      const y = height - padding - barHeight;
      histogramCtx.fillRect(x, y, Math.max(1, barWidth), barHeight);
    });

    histogramCtx.fillStyle = "rgba(255,255,255,.65)";
    histogramCtx.font = "12px Arial";
    histogramCtx.fillText("0", padding, height - 2);
    histogramCtx.fillText("127", width / 2 - 10, height - 2);
    histogramCtx.fillText("255", width - padding - 24, height - 2);
  }
}

function cloneImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function buildHistogram(imageData, channel) {
  const histogram = new Array(256).fill(0);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const value = channel === "master" || channel === "gray"
      ? Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
      : data[i + CHANNEL_INDEX[channel]];
    histogram[value] += 1;
  }

  return histogram;
}

function applyLevels(imageData, settings) {
  const result = cloneImageData(imageData);
  const data = result.data;

  const masterLut = createLut(settings.master || DEFAULT_LEVEL);
  const grayLut = settings.gray ? createLut(settings.gray) : null;
  const luts = {
    r: createLut(settings.r || DEFAULT_LEVEL),
    g: createLut(settings.g || DEFAULT_LEVEL),
    b: createLut(settings.b || DEFAULT_LEVEL),
    a: settings.a ? createLut(settings.a) : null,
  };

  for (let i = 0; i < data.length; i += 4) {
    let r = masterLut[data[i]];
    let g = masterLut[data[i + 1]];
    let b = masterLut[data[i + 2]];

    if (grayLut) {
      r = grayLut[r];
      g = grayLut[g];
      b = grayLut[b];
    } else {
      r = luts.r[r];
      g = luts.g[g];
      b = luts.b[b];
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;

    if (luts.a) {
      data[i + 3] = luts.a[data[i + 3]];
    }
  }

  return result;
}

function createLut({ black, white, gamma }) {
  const lut = new Uint8ClampedArray(256);
  const range = Math.max(1, white - black);

  for (let value = 0; value < 256; value += 1) {
    const normalized = Math.max(0, Math.min(1, (value - black) / range));
    lut[value] = Math.round(255 * Math.pow(normalized, gamma));
  }

  return lut;
}

function getHistogramColor(channel) {
  return {
    master: "rgba(230,230,230,.9)",
    gray: "rgba(200,200,200,.95)",
    r: "rgba(255,95,95,.95)",
    g: "rgba(95,230,135,.95)",
    b: "rgba(95,150,255,.95)",
    a: "rgba(210,210,210,.95)",
  }[channel] || "rgba(230,230,230,.9)";
}
