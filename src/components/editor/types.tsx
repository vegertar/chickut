import {
  Schema as ProsemirrorSchema,
  Node as ProsemirrorNode,
  Mark,
  NodeSpec,
  MarkSpec,
  NodeType,
  MarkType,
} from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { Engine, BlockRule, InlineRule, PostInlineRuleHandle } from "./engine";

export type ExtensionRule<T extends BlockRule | InlineRule> = Partial<
  Pick<T, "alt" | "handle">
> & {
  postHandle?: PostInlineRuleHandle;
};

export type ExtensionNodeSpec = NodeSpec & {
  toText?(node: ProsemirrorNode): string;
};

export type ExtensionMarkSpec = MarkSpec & {
  toText?(mark: Mark, content: string): string;
};

export type ExtensionPlugins<T extends NodeType | MarkType> = (
  type: T
) => Plugin[];

export type NodeExtension = {
  node: ExtensionNodeSpec;
  plugins?: Plugin[] | ExtensionPlugins<NodeType>;
  rule?: ExtensionRule<BlockRule>;
};

export type MarkExtension = {
  mark: ExtensionMarkSpec;
  plugins?: Plugin[] | ExtensionPlugins<MarkType>;
  rule?: ExtensionRule<InlineRule>;
};

export type PluginExtension = {
  plugins: Plugin[];
  rule?: ExtensionRule<BlockRule | InlineRule>;
};

export type Extension = NodeExtension | MarkExtension | PluginExtension;
export type ExtensionPack<T extends Extension = Extension> = ({
  name: string;
} & T)[];

export type ExtensionSchema = ProsemirrorSchema & {
  cached: {
    engine: Engine;
  };
};

export interface ExtensionEvents {
  load: Extension | ExtensionPack;
  ["off-load"]: Extension | ExtensionPack;
}

export interface ExtensionAction extends Partial<ExtensionEvents> {
  target: string;
}

export interface ExtensionState {
  extensions: Record<string, Extension>;
  packs: Record<string, string[]>;
}

export type EditorHandle = {
  view?: EditorView<ExtensionSchema>;
  version: [number, number];
};

export type ExtensionContextProps = {
  editor?: EditorHandle;
  dispatch?: React.Dispatch<ExtensionAction>;
};
