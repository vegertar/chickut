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

import {
  Engine,
  CoreRule,
  BlockRule,
  InlineRule,
  PostInlineRuleHandle,
} from "./engine";

export type ExtensionRule<
  T extends CoreRule | BlockRule | InlineRule
> = Partial<Pick<T, "alt" | "handle">> & {
  postHandle?: T extends InlineRule ? PostInlineRuleHandle : never;
};

export type RuledNodeSpec<T extends "block" | "inline"> = NodeSpec & {
  group: T;
  toText?: (node: ProsemirrorNode) => string;
};

export type RuledNodeExtension<T extends "block" | "inline"> = {
  node: RuledNodeSpec<
    T extends "block" ? "block" : T extends "inline" ? "inline" : never
  >;
  rule: ExtensionRule<
    T extends "block" ? BlockRule : T extends "inline" ? InlineRule : never
  >;
  plugins?: Plugin[] | ExtensionPlugins<NodeType>;
};

export type NonRuledNodeExtension = {
  node: NodeSpec;
  rule?: null;
  plugins?: Plugin[] | ExtensionPlugins<NodeType>;
};

export type NodeExtension =
  | RuledNodeExtension<"block">
  | RuledNodeExtension<"inline">
  | NonRuledNodeExtension;

export type ExtensionMarkSpec = MarkSpec & {
  toText?(mark: Mark, content: string): string;
};

export type ExtensionPlugins<T extends NodeType | MarkType> = (
  type: T
) => Plugin[];

export type MarkExtension = {
  mark: ExtensionMarkSpec;
  rule?: ExtensionRule<InlineRule>;
  plugins?: Plugin[] | ExtensionPlugins<MarkType>;
};

export type PluginExtension = {
  plugins: Plugin[];
  rule?: ExtensionRule<CoreRule>;
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
