import { useMemo } from "react";
import { NodeSpec, Node as ProsemirrorNode } from "prosemirror-model";
import { Decoration, DecorationSet } from "prosemirror-view";
import { textblockTypeInputRule } from "prosemirror-inputrules";
import { inputRules } from "prosemirror-inputrules";
import copy from "copy-to-clipboard";
import range from "lodash.range";
import escape from "lodash.escape";
import slugify from "slugify";

import { useExtension, NodeType, Plugin, Schema } from "../extension";
import { EditorState } from "prosemirror-state";

type Level = 1 | 2 | 3 | 4 | 5 | 6;

type Props = {
  className?: string;
  offset?: number;
  defaultLevel?: Level;
  maxLevel?: Level;
};

const defaultOffset = 0;
const initLevel: Level = 1;
const defaultMaxLevel: Level = 4;
const defaultClassName = "heading-name";

const handleCopyLink = (className: string) => {
  return ({ currentTarget }: Event) => {
    if (!(currentTarget instanceof Node)) {
      return;
    }

    // this is unfortunate but appears to be the best way to grab the anchor
    // as it's added directly to the dom by a decoration.

    const anchor = currentTarget.parentNode?.previousSibling;
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    if (!anchor.className.includes(className)) {
      throw new Error("Did not find anchor as previous sibling of heading");
    }
    const hash = `#${anchor.id}`;

    // the existing url might contain a hash already, lets make sure to remove
    // that rather than appending another one.
    const urlWithoutHash = window.location.href.split("#")[0];
    copy(urlWithoutHash + hash);

    // if (this.options.onShowToast) {
    //   this.options.onShowToast(
    //     this.options.dictionary.linkCopied,
    //     ToastType.Info
    //   );
    // }
    // TODO: show toast
  };
};

// Slugify, escape, and remove periods from headings so that they are
// compatible with both url hashes AND dom ID's (querySelector does not like
// ID's that begin with a number or a period, for example).
function safeSlugify(text: string) {
  return `h-${escape(
    slugify(text, {
      remove: /[!"#$%&'.()*+,/:;<=>?@[\]\\^_`{|}~]/g,
      lower: true,
    })
  )}`;
}

// calculates a unique slug for this heading based on it's text and position
// in the document that is as stable as possible
function headingToSlug(node: ProsemirrorNode, index = 0) {
  const slugified = safeSlugify(node.textContent);
  return index === 0 ? slugified : `${slugified}-${index}`;
}

const makeNodeSpec = (
  className = defaultClassName,
  offset = defaultOffset,
  defaultLevel: Level = initLevel,
  maxLevel: Level = defaultMaxLevel
): NodeSpec => ({
  attrs: {
    level: {
      default: defaultLevel,
    },
  },
  content: "inline*",
  group: "block",
  defining: true,
  draggable: false,
  parseDOM: range(1, maxLevel + 1).map((level) => ({
    tag: `h${level}`,
    attrs: { level },
  })),
  toDOM: (node) => {
    const button = document.createElement("button");
    button.innerText = "#";
    button.type = "button";
    button.className = "heading-anchor";
    button.addEventListener("click", handleCopyLink(className));

    return [`h${node.attrs.level + offset}`, button, ["span", 0]];
  },
});

const makePlugins = (
  className = defaultClassName,
  maxLevel: Level = defaultMaxLevel
) => (type: NodeType) => [
  new Plugin({
    props: {
      decorations: (state: EditorState<Schema>) => {
        const { doc } = state;
        const decorations: Decoration[] = [];
        const previouslySeen: Record<string, number> = {};

        doc.descendants((node, pos) => {
          if (node.type.name !== type.name) return;

          // calculate the optimal id
          const slug = headingToSlug(node);
          let id = slug;

          // check if we've already used it, and if so how many times?
          // Make the new id based on that number ensuring that we have
          // unique ID's even when headings are identical
          if (previouslySeen[slug] > 0) {
            id = headingToSlug(node, previouslySeen[slug]);
          }

          // record that we've seen this slug for the next loop
          previouslySeen[slug] =
            previouslySeen[slug] !== undefined ? previouslySeen[slug] + 1 : 1;

          decorations.push(
            Decoration.widget(pos, () => {
              const anchor = document.createElement("a");
              anchor.id = id;
              anchor.className = className;
              return anchor;
            })
          );
        });

        return DecorationSet.create(doc, decorations);
      },
    },
  }),

  inputRules({
    rules: range(1, maxLevel + 1).map((level) =>
      textblockTypeInputRule(new RegExp(`^(#{1,${level}})\\s$`), type, () => ({
        level,
      }))
    ),
  }),
];

export default function Heading({
  className,
  offset,
  defaultLevel,
  maxLevel,
}: Props = {}) {
  useExtension(
    useMemo(
      () => ({
        name: Heading.name,
        node: makeNodeSpec(className, offset, defaultLevel, maxLevel),
        plugins: makePlugins(className, maxLevel),
      }),
      [className, offset, defaultLevel, maxLevel]
    )
  );

  return null;
}

Heading.node = makeNodeSpec();
Heading.plugins = makePlugins();
