export const INTERPOLATION_METHODS = {
  nearest: {
    title: "Ближайший сосед",
    description: "Быстрый метод: каждый новый пиксель получает цвет ближайшего исходного пикселя. Подходит для пиксель-арта и резких границ, но может давать ступеньки."
  },
  bilinear: {
    title: "Билинейная интерполяция",
    description: "Плавный метод: цвет нового пикселя рассчитывается по четырём соседним пикселям исходного изображения. Хорошо подходит для фотографий и используется по умолчанию."
  }
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPixel(data, width, height, x, y, channel) {
  const safeX = clamp(x, 0, width - 1);
  const safeY = clamp(y, 0, height - 1);
  return data[(safeY * width + safeX) * 4 + channel];
}

function resizeNearest(sourceImageData, targetWidth, targetHeight) {
  const sourceWidth = sourceImageData.width;
  const sourceHeight = sourceImageData.height;
  const source = sourceImageData.data;
  const output = new ImageData(targetWidth, targetHeight);
  const result = output.data;

  const xRatio = targetWidth > 1 ? (sourceWidth - 1) / (targetWidth - 1) : 0;
  const yRatio = targetHeight > 1 ? (sourceHeight - 1) / (targetHeight - 1) : 0;

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.round(y * yRatio);

    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.round(x * xRatio);
      const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
      const targetIndex = (y * targetWidth + x) * 4;

      result[targetIndex] = source[sourceIndex];
      result[targetIndex + 1] = source[sourceIndex + 1];
      result[targetIndex + 2] = source[sourceIndex + 2];
      result[targetIndex + 3] = source[sourceIndex + 3];
    }
  }

  return output;
}

function resizeBilinear(sourceImageData, targetWidth, targetHeight) {
  const sourceWidth = sourceImageData.width;
  const sourceHeight = sourceImageData.height;
  const source = sourceImageData.data;
  const output = new ImageData(targetWidth, targetHeight);
  const result = output.data;

  const xRatio = targetWidth > 1 ? (sourceWidth - 1) / (targetWidth - 1) : 0;
  const yRatio = targetHeight > 1 ? (sourceHeight - 1) / (targetHeight - 1) : 0;

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = y * yRatio;
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(y0 + 1, sourceHeight - 1);
    const dy = sourceY - y0;

    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = x * xRatio;
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(x0 + 1, sourceWidth - 1);
      const dx = sourceX - x0;
      const targetIndex = (y * targetWidth + x) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        const topLeft = getPixel(source, sourceWidth, sourceHeight, x0, y0, channel);
        const topRight = getPixel(source, sourceWidth, sourceHeight, x1, y0, channel);
        const bottomLeft = getPixel(source, sourceWidth, sourceHeight, x0, y1, channel);
        const bottomRight = getPixel(source, sourceWidth, sourceHeight, x1, y1, channel);

        const top = topLeft * (1 - dx) + topRight * dx;
        const bottom = bottomLeft * (1 - dx) + bottomRight * dx;
        result[targetIndex + channel] = Math.round(top * (1 - dy) + bottom * dy);
      }
    }
  }

  return output;
}

export function resizeImageData(sourceImageData, targetWidth, targetHeight, method = "bilinear") {
  if (!sourceImageData) {
    throw new Error("Нет исходного изображения для масштабирования.");
  }

  const safeWidth = Math.max(1, Math.round(targetWidth));
  const safeHeight = Math.max(1, Math.round(targetHeight));

  if (method === "nearest") {
    return resizeNearest(sourceImageData, safeWidth, safeHeight);
  }

  return resizeBilinear(sourceImageData, safeWidth, safeHeight);
}
