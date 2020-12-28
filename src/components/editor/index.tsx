import Editor from "./editor";

export * from "./hooks";
export * from "./extension";
export * from "./engine";
export * from "./plugin";

export default Editor;

export type { CoreRule, BlockRule, InlineRule, Token } from "./engine";
export type {
  ExtensionPack,
  NodeExtension,
  MarkExtension,
  PluginExtension,
  ExtensionSchema,
} from "./types";
