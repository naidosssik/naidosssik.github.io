import { resizeImageData, INTERPOLATION_METHODS } from "./interpolation.js";

export function initResizeDialog({
  getImageData,
  commitImageData,
}) {
  const dialog = document.getElementById("resizeDialog");
  const openBtn = document.getElementById("openResizeBtn");

  const widthInput = document.getElementById("resizeWidth");
  const heightInput = document.getElementById("resizeHeight");
  const unitSelect = document.getElementById("resizeUnit");
  const widthUnit = document.getElementById("resizeWidthUnit");
  const heightUnit = document.getElementById("resizeHeightUnit");

  function updateResizeUnits() {
    const unit = unitSelect.value === "percent" ? "%" : "px";

    widthUnit.textContent = unit;
    heightUnit.textContent = unit;

    const imageData = getImageData();

    if (!imageData) return;

    if (unitSelect.value === "percent") {
      widthInput.value = 100;
      heightInput.value = 100;
    } else {
      widthInput.value = imageData.width;
      heightInput.value = imageData.height;
    }
  }

  const keepAspectRatio = document.getElementById("keepAspectRatio");
  const interpolationSelect = document.getElementById("resizeInterpolation");
  const tooltip = document.getElementById("interpolationTooltip");

  openBtn.addEventListener("click", () => {
    const imageData = getImageData();

    if (!imageData) {
      alert("Сначала загрузите изображение.");
      return;
    }

    widthInput.value = imageData.width;
    heightInput.value = imageData.height;

    tooltip.textContent =
      INTERPOLATION_METHODS[interpolationSelect.value].description;

    dialog.showModal();
    updateResizeUnits();
  });

  interpolationSelect.addEventListener("change", () => {
    tooltip.textContent =
      INTERPOLATION_METHODS[interpolationSelect.value].description;
  });
  unitSelect.addEventListener("change", updateResizeUnits);

  document.getElementById("resizeApplyBtn").addEventListener("click", () => {
    const imageData = getImageData();

    let newWidth = Number(widthInput.value);
    let newHeight = Number(heightInput.value);

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