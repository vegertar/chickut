import { useTextExtension } from "../../../editor";

import handle from "./handle";
import item from "./item";
import bulleted from "./bulleted";
import numbered from "./numbered";

import "./style.scss";

export default function List(props?: { text?: string }) {
  useTextExtension(List.pack, props?.text);
  return null;
}

List.pack = [
  bulleted,
  numbered,

  {
    ...item,
    rule: {
      handle,
      alt: ["paragraph", "reference", "blockquote"],
    },
  },
];
