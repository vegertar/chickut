import { NodeSpec } from "../../../editor";

import item from "./item";

const bulleted = {
  name: "bulletedlist",

  node: {
    content: `${item.name}+`,
    group: "block",
    parseDOM: [{ tag: "ul" }],
    toDOM: () => ["ul", 0],
  } as NodeSpec,
};

export default bulleted;
