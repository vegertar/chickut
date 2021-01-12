import { useStrikethroughExtension } from "../strikethrough";

export default function Insert() {
  useStrikethroughExtension("insert", "ins", 0x2b /* + */);
  return null;
}
