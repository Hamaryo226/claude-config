import { parseLine } from "./parser.js";

export function parseAll(text) {
  return text.split("\n").map(parseLine).filter(Boolean);
}
