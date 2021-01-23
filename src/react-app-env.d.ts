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

  type InlineElement = {
    nodeName: "#text";
    data: string;
  };

  type BlockElement = {
    nodeName: string;
    childNodes: Element[];
  };

  type Element = InlineElement | BlockElement;

  export interface AddAttribute {
    action: "addAttribute";
    name: string;
    route: number[];
    value: string;
  }

  export interface ModifyAttribute {
    action: "modifyAttribute";
    name: string;
    route: number[];
    value: string;
  }

  export interface RemoveAttribute {
    action: "removeAttribute";
    name: string;
    route: number[];
    value: string;
  }

  export interface AddTextElement {
    action: "addTextElement";
    route: number[];
    value: string;
  }

  export interface RemoveTextElement {
    action: "removeTextElement";
    route: number[];
    value: string;
  }

  export interface ModifyTextElement {
    action: "modifyTextElement";
    route: number[];
    oldValue: string;
    newValue: string;
  }

  export interface AddElement {
    action: "addElement";
    route: number[];
    element: Element;
  }

  export interface RemoveElement {
    action: "removeElement";
    route: number[];
    element: Element;
  }

  export interface ReplaceElement {
    action: "replaceElement";
    route: number[];
    oldValue: Element;
    newValue: Element;
  }

  export interface RelocateGroup {
    action: "relocateGroup";
    route: number[];
    groupLength: number;
    from: number;
    to: number;
  }

  export interface ModifyValue {
    action: "modifyValue";
    route: number[];
    oldValue: string;
    newValue: string;
  }

  export interface ModifyChecked {
    action: "modifyChecked";
    route: number[];
    oldValue: boolean;
    newValue: boolean;
  }

  export interface ModifySelected {
    action: "modifySelected";
    route: number[];
    oldValue: boolean;
    newValue: boolean;
  }

  export interface ModifyComment {
    action: "modifyComment";
    route: number[];
    oldValue: string;
    newValue: string;
  }

  export type Diff =
    | AddAttribute
    | ModifyAttribute
    | RemoveAttribute
    | AddTextElement
    | RemoveTextElement
    | ModifyTextElement
    | AddElement
    | RemoveElement
    | ReplaceElement
    | RelocateGroup
    | ModifyValue
    | ModifyChecked
    | ModifySelected
    | ModifyComment;

  type Diffs = Diff[];

  export class DiffDOM {
    constructor(options?: Options);
    apply(tree: Node, diffs: Diffs): boolean;
    undo(tree: Node, diffs: Diffs): void;
    diff(t1Node: Node, t2Node: Node): Diffs;
  }
}
