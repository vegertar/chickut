import Editor from "./editor";

export * from "./hooks";
export * from "./extension";
export * from "./runtime";
export * from "./engine";

export default Editor;

export type { CoreRule, BlockRule, InlineRule, Token } from "./engine";
export type {
  ExtensionPack,
  NodeExtension,
  MarkExtension,
  PluginExtension,
  Schema,
} from "./manager";
