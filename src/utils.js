export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function replaceExtension(fileName, newExt) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1
    ? `${fileName}.${newExt}`
    : `${fileName.slice(0, dotIndex)}.${newExt}`;
}
