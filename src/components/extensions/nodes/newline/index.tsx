import {
  InlineRuleHandle,
  isSpace,
  NodeExtension,
  useExtension,
} from "../../../editor";

const SPACES_RE = / +$/;

const handle: InlineRuleHandle = function newline(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 0x0a /* \n */) {
    return false;
  }

  const pmax = state.pending.length - 1;
  const max = state.posMax;

  // '  \n' -> hardbreak
  // Lookup in pending chars is bad practice! Don't copy to other rules!
  // Pending string is stored in concat mode, indexed lookups will cause
  // convertion to flat mode.
  if (!silent) {
    let softbreak = false;
    if (pmax >= 0 && state.pending.charCodeAt(pmax) === 0x20) {
      if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 0x20) {
        state.pending = state.pending.replace(SPACES_RE, "");
        state.push(this.name, 0); //.markup = "hardbreak";
      } else {
        state.pending = state.pending.slice(0, -1);
        softbreak = true;
      }
    } else {
      softbreak = true;
    }

    if (softbreak) {
      const token = state.push("text", 0);
      token.content = "\n";
      // token.markup = "softbreak";
    }
  }

  pos++;

  // skip heading spaces for next line
  while (pos < max && isSpace(state.src.charCodeAt(pos))) {
    pos++;
  }

  state.pos = pos;
  return true;
};

const extension: NodeExtension = {
  rule: { handle },
  node: {
    inline: true,
    group: "inline",
    selectable: false,
    parseDOM: [{ tag: "br" }],
    toDOM: () => ["br"],
  },
};

export default function Newline() {
  useExtension(extension, "newline");
  return null;
}
