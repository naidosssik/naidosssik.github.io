import { clamp } from "./utils.js";

export function encodeGB7(imageData, includeMask = false) {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  const bytes = new Uint8Array(12 + pixelCount);

  // Signature: G B 7 0x1D
  bytes[0] = 0x47;
  bytes[1] = 0x42;
  bytes[2] = 0x37;
  bytes[3] = 0x1d;

  // Version
  bytes[4] = 0x01;

  // Flags
  bytes[5] = includeMask ? 0x01 : 0x00;

  // Width, Height (big-endian)
  bytes[6] = (width >> 8) & 0xff;
  bytes[7] = width & 0xff;
  bytes[8] = (height >> 8) & 0xff;
  bytes[9] = height & 0xff;

  // Reserved
  bytes[10] = 0x00;
  bytes[11] = 0x00;

  for (let i = 0; i < pixelCount; i++) {
    const si = i * 4;
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    const a = data[si + 3];

    // Перевод в grayscale по яркости
    const gray8 = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    // Приведение 0..255 -> 0..127
    const gray7 = clamp(Math.round((gray8 / 255) * 127), 0, 127);

    let maskBit = 0;
    if (includeMask) {
      maskBit = a >= 128 ? 1 : 0;
    }

    bytes[12 + i] = (maskBit << 7) | gray7;
  }

  return new Blob([bytes], { type: "application/octet-stream" });
}

export function decodeGB7(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length < 12) {
    throw new Error("Файл слишком короткий для формата GB7.");
  }

  if (
    bytes[0] !== 0x47 ||
    bytes[1] !== 0x42 ||
    bytes[2] !== 0x37 ||
    bytes[3] !== 0x1d
  ) {
    throw new Error("Неверная сигнатура GB7.");
  }

  const version = bytes[4];

  if (version !== 0x01) {
    throw new Error(`Неподдерживаемая версия GB7: ${version}`);
  }

  const flags = bytes[5];
  const hasMask = (flags & 0b00000001) !== 0;

  if ((flags & 0b11111110) !== 0) {
    throw new Error("Некорректные флаги GB7.");
  }

  const width = (bytes[6] << 8) | bytes[7];
  const height = (bytes[8] << 8) | bytes[9];

  const reserved = (bytes[10] << 8) | bytes[11];

  if (reserved !== 0) {
    throw new Error("Некорректный GB7: reserved-байты должны быть равны 0.");
  }

  const pixelCount = width * height;
  const expectedLength = 12 + pixelCount;

  if (bytes.length < expectedLength) {
    throw new Error(
      `Некорректный размер файла. Ожидалось ${expectedLength} байт, получено ${bytes.length}.`
    );
  }

  if (width === 0 || height === 0) {
    throw new Error("Некорректные размеры изображения");
  }

  const rgba = new Uint8ClampedArray(pixelCount * 4);

  for (let i = 0; i < pixelCount; i++) {
    const byte = bytes[12 + i];

    const gray7 = byte & 0b01111111;
    const maskBit = (byte & 0b10000000) >>> 7;

    const gray8 = Math.round((gray7 / 127) * 255);

    const index = i * 4;

    rgba[index] = gray8;
    rgba[index + 1] = gray8;
    rgba[index + 2] = gray8;
    rgba[index + 3] = hasMask ? (maskBit === 1 ? 255 : 0) : 255;
  }

  return {
    imageData: new ImageData(rgba, width, height),
    width,
    height,
    hasMask,
  };
}