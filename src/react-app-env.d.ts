/// <reference types="react-scripts" />

declare module "uc.micro" {
  export const Any: RegExp;
  export const Cc: RegExp;
  export const Cf: RegExp;
  export const P: RegExp;
  export const Z: RegExp;
}

declare module "diff-dom" {
  type Options = {
    debug?: boolean;
    diffcap?: number; // Limit for how many diffs are accepting when debugging. Inactive when debug is false.
    maxDepth?: boolean; // False or a numeral. If set to a numeral| limits the level of depth that the the diff mechanism looks for differences. If false| goes through the entire tree.
    maxChildCount?: number; // False or a numeral. If set to a numeral| only does a simplified form of diffing of contents so that the number of diffs cannot be higher than the number of child nodes.
    valueDiffing?: boolean; // Whether to take into consideration the values of forms that differ from auto assigned values (when a user fills out a form).
    textDiff?: (node, currentValue, expectedValue, newValue) => void;
    compress?: boolean; // Whether to work with compressed diffs
  };

  type Action =
    | "addAttribute"
    | "modifyAttribute"
    | "removeAttribute"
    | "modifyTextElement"
    | "relocateGroup"
    | "removeElement"
    | "addElement"
    | "removeTextElement"
    | "addTextElement"
    | "replaceElement"
    | "modifyValue"
    | "modifyChecked"
    | "modifySelected"
    | "modifyComment";

  class Diff {
    action: Action;
    newValue: string;
    oldValue: string;
    route: [number, number];
  }

  export class DiffDOM {
    constructor(options?: Options);
    apply(tree: Node, diffs: Diff[]): boolean;
    undo(tree: Node, diffs: Diff[]): void;
    diff(t1Node: any, t2Node: any): Diff[];
  }
}
