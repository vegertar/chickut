import { useSubscriptExtension } from "../subscript";

export default function Superscript() {
  useSubscriptExtension("superscript", "sup", 0x5e /* ^ */);
  return null;
}
