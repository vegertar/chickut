import { useStrikethroughExtension } from "../strikethrough";

export default function Mark() {
  useStrikethroughExtension("mark", "mark", 0x3d /* = */);
  return null;
}
