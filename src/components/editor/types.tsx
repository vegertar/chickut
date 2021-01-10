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

export type RuleNodeSpec<T extends "block" | "inline"> = NodeSpec & {
  group: T;
  toText?: (node: ProsemirrorNode) => string;
};

export type RuleMarkSpec = MarkSpec & {
  toText?(mark: Mark, content: string): string;
};

type RuleNodeGroups = "block" | "inline";

export type RuleNodeExtension<T extends RuleNodeGroups> = {
  node: T extends "block"
    ? RuleNodeSpec<"block">
    : T extends "inline"
    ? RuleNodeSpec<"inline">
    : never;
  rule: T extends "block"
    ? ExtensionRule<BlockRule>
    : T extends "inline"
    ? ExtensionRule<InlineRule>
    : never;
  plugins?: Plugin[] | ExtensionPlugins<RuleNodeExtension<T>, NodeType>;
};

export type RuleMarkExtension = {
  mark: RuleMarkSpec;
  rule: ExtensionRule<InlineRule>;
  plugins?: Plugin[] | ExtensionPlugins<RuleMarkExtension, MarkType>;
};

export type NonRuleNodeExtension = {
  node: NodeSpec;
  rule?: null;
  plugins?: Plugin[] | ExtensionPlugins<NonRuleNodeExtension, NodeType>;
};

export type NonRuleMarkExtension = {
  mark: MarkSpec;
  rule?: null;
  plugins?: Plugin[] | ExtensionPlugins<NonRuleMarkExtension, MarkType>;
};

export type NodeExtension =
  | RuleNodeExtension<"block">
  | RuleNodeExtension<"inline">
  | NonRuleNodeExtension;

export type MarkExtension = NonRuleMarkExtension | RuleMarkExtension;

export type RuleExtension =
  | Pick<RuleNodeExtension<RuleNodeGroups>, "rule">
  | Pick<RuleMarkExtension, "rule">;

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

export type PurePluginExtension<T extends Record<string, any> = {}> = T & {
  plugins: Plugin[] | ExtensionPlugins<PurePluginExtension<T>, ExtensionSchema>;
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
  // we use the existence of property node/mark to determine the corresponding extension type, so an extension should have at most one such properties
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
