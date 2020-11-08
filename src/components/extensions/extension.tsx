import { useEffect } from "react";
import OrderedMap from "orderedmap";
import { InputRule } from "prosemirror-inputrules";
import { Plugin, EditorState, Transaction } from "prosemirror-state";
import {
  Schema as ProsemirrorSchema,
  Mark as ProsemirrorMark,
  MarkType,
  Node as ProsemirrorNode,
  NodeType,
  MarkSpec,
  NodeSpec,
  SchemaSpec,
} from "prosemirror-model";
import {
  Command as ProsemirrorCommand,
  Keymap,
  toggleMark,
} from "prosemirror-commands";
import {
  TokenConfig,
  MarkdownSerializerState,
  MarkSerializerConfig,
} from "prosemirror-markdown";
import { EditorView } from "prosemirror-view";

export type Command = (attrs: Record<string, any>) => ProsemirrorCommand;

export interface MarkSpecs {}
export interface NodeSpecs {}

export type Schema = ProsemirrorSchema<keyof NodeSpecs, keyof MarkSpecs>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const Schema = ProsemirrorSchema;

export type ExtensionProps = {
  view?: EditorView<Schema>;
  dispatch?: React.Dispatch<ExtensionAction>;
};

export type ExtensionAction = {
  state?: EditorState<Schema>;
  transcations?: Transaction<Schema>[];
};

export function useNodes(specs: NodeSpecs, { view, dispatch }: ExtensionProps) {
  useEffect(() => {
    if (!view || !dispatch) {
      return;
    }

    type Map = OrderedMap<NodeSpec>;

    dispatch({
      state: view.state.reconfigure({
        schema: new Schema({
          marks: view.state.schema.spec.marks,
          nodes: (view.state.schema.spec.nodes as Map).append(specs as any),
        } as SchemaSpec),
      }),
    });

    return () => {
      dispatch({
        state: view.state.reconfigure({
          schema: new Schema({
            marks: view.state.schema.spec.marks,
            nodes: (view.state.schema.spec.nodes as Map).subtract(specs as any),
          } as SchemaSpec),
        }),
      });
    };
  }, [specs, view, dispatch]);
}

export function useMarks(specs: MarkSpecs, { view, dispatch }: ExtensionProps) {
  useEffect(() => {
    if (!view || !dispatch) {
      return;
    }

    type Map = OrderedMap<MarkSpec>;

    dispatch({
      state: view.state.reconfigure({
        schema: new Schema({
          nodes: view.state.schema.spec.nodes,
          marks: (view.state.schema.spec.marks as Map).append(specs as any),
        } as SchemaSpec),
      }),
    });

    return () => {
      dispatch({
        state: view.state.reconfigure({
          schema: new Schema({
            nodes: view.state.schema.spec.nodes,
            marks: (view.state.schema.spec.marks as Map).subtract(specs as any),
          } as SchemaSpec),
        }),
      });
    };
  }, [specs, view, dispatch]);
}

export type Options = {
  schema: Schema;
};

export type NodeOptions = Options & { type: NodeType<Schema> };
export type MarkOptions = Options & { type: MarkType<Schema> };

type ExtensionType = "extension" | "mark" | "node";

export default abstract class Extension {
  readonly type: ExtensionType = "extension";
  readonly options: Record<string, any>;

  readonly defaultOptions?: Record<string, any>;
  readonly plugins?: Plugin<Schema>[];
  readonly markdownToken?: string;
  readonly parsedMarkdown?: TokenConfig;

  constructor(options?: Record<string, any>) {
    this.options = {
      ...this.defaultOptions,
      ...options,
    };
  }

  keymap(options: Options): Keymap<Schema> | undefined {
    return;
  }

  inputRules(options: Options): InputRule<Schema>[] | undefined {
    return;
  }

  commands(options: Options): Record<string, Command> | Command {
    return () => () => false;
  }
}

export abstract class Node extends Extension {
  readonly type: ExtensionType = "node";

  toMarkdown(
    state: MarkdownSerializerState<Schema>,
    node: ProsemirrorNode<Schema>
  ) {
    console.error(`toMarkdown not implemented`, state, node);
  }

  keymap(options: NodeOptions): Keymap<Schema> | undefined {
    return;
  }

  inputRules(options: NodeOptions): InputRule<Schema>[] | undefined {
    return;
  }

  commands(options: NodeOptions): Record<string, Command> | Command {
    return () => () => false;
  }
}

export abstract class Mark extends Extension {
  readonly type: ExtensionType = "mark";

  get toMarkdown(): MarkSerializerConfig<Schema> | undefined {
    return undefined;
  }

  keymap(options: MarkOptions): Keymap<Schema> | undefined {
    return undefined;
  }

  inputRules(options: MarkOptions): InputRule<Schema>[] | undefined {
    return undefined;
  }

  commands({ type }: MarkOptions): Record<string, Command> | Command {
    return () => toggleMark(type);
  }

  protected getMarksBetween(
    start: number,
    end: number,
    state: EditorState<Schema>
  ) {
    let marks: { start: number; end: number; mark: ProsemirrorMark }[] = [];

    state.doc.nodesBetween(start, end, (node, pos) => {
      marks = [
        ...marks,
        ...node.marks.map((mark) => ({
          start: pos,
          end: pos + node.nodeSize,
          mark,
        })),
      ];
    });

    return marks;
  }

  protected markInputRule(
    regexp: RegExp,
    markType: MarkType<Schema>,
    getAttrs?: (match: string[]) => Record<string, any>
  ) {
    return new InputRule<Schema>(
      regexp,
      (
        state: EditorState<Schema>,
        match: string[],
        start: number,
        end: number
      ) => {
        const attrs = getAttrs?.(match);
        const { tr } = state;
        const m = match.length - 1;
        let markEnd = end;
        let markStart = start;

        if (match[m]) {
          const matchStart = start + match[0].indexOf(match[m - 1]);
          const matchEnd = matchStart + match[m - 1].length - 1;
          const textStart = matchStart + match[m - 1].lastIndexOf(match[m]);
          const textEnd = textStart + match[m].length;

          const excludedMarks = this.getMarksBetween(start, end, state)
            .filter((item) => item.mark.type.excludes(markType))
            .filter((item) => item.end > matchStart);

          if (excludedMarks.length) {
            return null;
          }

          if (textEnd < matchEnd) {
            tr.delete(textEnd, matchEnd);
          }
          if (textStart > matchStart) {
            tr.delete(matchStart, textStart);
          }
          markStart = matchStart;
          markEnd = markStart + match[m].length;
        }

        tr.addMark(markStart, markEnd, markType.create(attrs));
        tr.removeStoredMark(markType);
        return tr;
      }
    );
  }
}
