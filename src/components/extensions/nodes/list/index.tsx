import { useExtension, ExtensionPack, NodeExtension } from "../../../editor";

import bulleted from "./bulleted";
import numbered from "./numbered";
import item from "./item";

import "./style.scss";

const pack: ExtensionPack<NodeExtension> = [bulleted, numbered, item];

export default function List() {
  useExtension(pack, "list");
  return null;
}
