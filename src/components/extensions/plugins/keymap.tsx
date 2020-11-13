import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";

import { useExtension } from "../extension";

export default function Keymap() {
  useExtension(Keymap);
  return null;
}

Keymap.plugins = [keymap(baseKeymap)];
