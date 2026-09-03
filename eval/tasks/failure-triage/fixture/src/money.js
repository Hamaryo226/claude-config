/** 金額を最小単位 (銭) の整数で扱う。二進小数の誤差をここで吸収する。 */
export function toMinor(amount) {
  return Math.floor(amount * 100);
}

export function fromMinor(minor) {
  return minor / 100;
}

export function formatJpy(minor) {
  return `¥${Math.round(minor / 100).toLocaleString("en-US")}`;
}
