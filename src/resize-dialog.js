import { resizeImageData, INTERPOLATION_METHODS } from "./interpolation.js";

export function initResizeDialog({ getImageData, commitImageData }) {
  const dialog = document.getElementById("resizeDialog");
  const openBtn = document.getElementById("openResizeBtn");

  const widthInput = document.getElementById("resizeWidth");
  const heightInput = document.getElementById("resizeHeight");
  const unitSelect = document.getElementById("resizeUnit");
  const widthUnit = document.getElementById("resizeWidthUnit");
  const heightUnit = document.getElementById("resizeHeightUnit");
  const keepAspectRatio = document.getElementById("keepAspectRatio");
  const interpolationSelect = document.getElementById("resizeInterpolation");
  const tooltip = document.getElementById("interpolationTooltip");

  const pixelsBefore = document.getElementById("pixelsBefore");
  const pixelsAfter = document.getElementById("pixelsAfter");

  let originalWidth = 0;
  let originalHeight = 0;
  let aspectRatio = 1;
  let isUpdating = false;

  function formatPixels(width, height) {
    const pixels = width * height;
    const megapixels = pixels / 1_000_000;

    return `${width} × ${height} px (${megapixels.toFixed(2)} МП)`;
  }

  function getTargetSize() {
    const widthValue = Number(widthInput.value);
    const heightValue = Number(heightInput.value);

    if (unitSelect.value === "percent") {
      return {
        width: Math.round(originalWidth * widthValue / 100),
        height: Math.round(originalHeight * heightValue / 100),
      };
    }

    return {
      width: Math.round(widthValue),
      height: Math.round(heightValue),
    };
  }

  function updatePixelsInfo() {
    if (!originalWidth || !originalHeight) return;

    const target = getTargetSize();

    pixelsBefore.textContent = formatPixels(originalWidth, originalHeight);
    pixelsAfter.textContent = formatPixels(target.width, target.height);
  }

  function updateResizeUnits() {
    const unit = unitSelect.value === "percent" ? "%" : "px";

    widthUnit.textContent = unit;
    heightUnit.textContent = unit;

    if (unitSelect.value === "percent") {
      widthInput.value = 100;
      heightInput.value = 100;
    } else {
      widthInput.value = originalWidth;
      heightInput.value = originalHeight;
    }

    updatePixelsInfo();
  }

  function syncHeightByWidth() {
    if (!keepAspectRatio.checked || isUpdating) return;

    isUpdating = true;

    if (unitSelect.value === "percent") {
      heightInput.value = widthInput.value;
    } else {
      const width = Number(widthInput.value);
      heightInput.value = Math.round(width / aspectRatio);
    }

    isUpdating = false;
    updatePixelsInfo();
  }

  function syncWidthByHeight() {
    if (!keepAspectRatio.checked || isUpdating) return;

    isUpdating = true;

    if (unitSelect.value === "percent") {
      widthInput.value = heightInput.value;
    } else {
      const height = Number(heightInput.value);
      widthInput.value = Math.round(height * aspectRatio);
    }

    isUpdating = false;
    updatePixelsInfo();
  }

  openBtn.addEventListener("click", () => {
    const imageData = getImageData();

    if (!imageData) {
      alert("Сначала загрузите изображение.");
      return;
    }

    originalWidth = imageData.width;
    originalHeight = imageData.height;
    aspectRatio = originalWidth / originalHeight;

    tooltip.textContent =
      INTERPOLATION_METHODS[interpolationSelect.value].description;

    updateResizeUnits();
    dialog.showModal();
  });

  unitSelect.addEventListener("change", updateResizeUnits);

  widthInput.addEventListener("input", syncHeightByWidth);
  heightInput.addEventListener("input", syncWidthByHeight);

  interpolationSelect.addEventListener("change", () => {
    tooltip.textContent =
      INTERPOLATION_METHODS[interpolationSelect.value].description;
  });

  document.getElementById("resizeApplyBtn").addEventListener("click", () => {
    const imageData = getImageData();
    const { width: newWidth, height: newHeight } = getTargetSize();

    if (!Number.isFinite(newWidth) || !Number.isFinite(newHeight)) {
      alert("Введите корректные числа.");
      return;
    }

    if (newWidth < 1 || newHeight < 1) {
      alert("Размер должен быть больше 0.");
      return;
    }

    if (newWidth > 10000 || newHeight > 10000) {
      alert("Слишком большой размер изображения.");
      return;
    }

    const resized = resizeImageData(
      imageData,
      newWidth,
      newHeight,
      interpolationSelect.value
    );

    commitImageData(resized);
    dialog.close();
  });

  document.getElementById("resizeCancelBtn").addEventListener("click", () => {
    dialog.close();
  });

  document.getElementById("resizeCancelX").addEventListener("click", () => {
    dialog.close();
  });
}