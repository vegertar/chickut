import { useExtension, ExtensionPack } from "../../../editor";

import handle from "./handle";
import plugins from "./plugins";
import item from "./item";
import bulleted from "./bulleted";
import numbered from "./numbered";

import "./style.scss";

export default function List() {
  useExtension(List.pack);
  return null;
}

List.pack = [
  bulleted,
  numbered,

  {
    ...item,
    plugins,
    rule: {
      handle,
      alt: ["paragraph", "reference", "blockquote"],
    },
  },
] as ExtensionPack;
