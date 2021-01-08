import {
  Schema as ProsemirrorSchema,
  Node as ProsemirrorNode,
  Mark,
  NodeSpec,
  MarkSpec,
  NodeType as ProsemirrorNodeType,
  MarkType as ProsemirrorMarkType,
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

export type ExtensionSchema = ProsemirrorSchema & {
  cached: {
    engine: Engine;
  };
};

export type NodeType = ProsemirrorNodeType<ExtensionSchema>;
export type MarkType = ProsemirrorMarkType<ExtensionSchema>;

export type ExtensionRule<
  T extends CoreRule | BlockRule | InlineRule
> = Partial<Pick<T, "alt" | "handle">> & {
  postHandle?: T extends InlineRule ? PostInlineRuleHandle : never;
};

export type ExtensionPlugins<
  ThisT,
  T extends NodeType | MarkType | ExtensionSchema
> = (this: ThisT & { name: string }, type: T) => Plugin[];

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
  plugins?: Plugin[] | ExtensionPlugins<RuledNodeExtension<T>, NodeType>;
};

export type NonRuledNodeExtension = {
  node: NodeSpec;
  plugins?: Plugin[] | ExtensionPlugins<NonRuledNodeExtension, NodeType>;
};

export type NodeExtension =
  | NonRuledNodeExtension
  | RuledNodeExtension<"block">
  | RuledNodeExtension<"inline">;

export type ExtensionMarkSpec = MarkSpec & {
  toText?(mark: Mark, content: string): string;
};

export type MarkExtension = {
  mark: ExtensionMarkSpec;
  rule?: ExtensionRule<InlineRule>;
  plugins?: Plugin[] | ExtensionPlugins<MarkExtension, MarkType>;
};

export type RuledExtension =
  | Pick<RuledNodeExtension<"block" | "inline">, "rule">
  | Pick<MarkExtension, "rule">;

export type AfterPluginExtension<T extends "node" | "mark"> = {
  type: T;
  after: string;
  plugins:
    | Plugin[]
    | ExtensionPlugins<
        AfterPluginExtension<T>,
        T extends "node" ? NodeType : T extends "mark" ? MarkType : never
      >;
};

export type PurePluginExtension = {
  plugins: Plugin[] | ExtensionPlugins<PurePluginExtension, ExtensionSchema>;
  [key: string]: any;
};

export type PluginExtension =
  | AfterPluginExtension<"node">
  | AfterPluginExtension<"mark">
  | PurePluginExtension;

export type Extension = NodeExtension | MarkExtension | PluginExtension;
export type ExtensionPack<T extends Extension = Extension> = ({
  name: string;
} & T)[];

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
