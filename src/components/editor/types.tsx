import {
  Schema as ProsemirrorSchema,
  NodeSpec,
  MarkSpec,
  NodeType,
  MarkType,
} from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import Engine, { BlockRule, InlineRule } from "./engine";

export type ExtensionRule = Partial<
  Pick<BlockRule | InlineRule, "alt" | "handle">
>;
export type ExtensionSpec<T> = T;
export type ExtensionPlugins<T> = (type: T) => Plugin[];

type BaseExtension = {
  rule?: ExtensionRule;
};

export type NodeExtension = BaseExtension & {
  node: ExtensionSpec<NodeSpec>;
  plugins?: Plugin[] | ExtensionPlugins<NodeType>;
};

export type MarkExtension = BaseExtension & {
  mark: ExtensionSpec<MarkSpec>;
  plugins?: Plugin[] | ExtensionPlugins<MarkType>;
};

export type PluginExtension = BaseExtension & {
  plugins: Plugin[];
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
  version: number;
};

export type ExtensionContextProps = {
  editor?: EditorHandle;
  name?: string;
  dispatch?: React.Dispatch<ExtensionAction>;
};
