import { useEffect, useState } from "react";
import React, { NodeSpec, NodeType } from "prosemirror-model";
import { inputRules, textblockTypeInputRule } from "prosemirror-inputrules";
import { parseModule, ESTree } from "meriyah";

import { useExtension, Extension } from "../../../editor";

import "./style.scss";

function parse(code?: string) {
  return parseModule(code || "");
}

type ESTreeNodeType = ESTree.Node["type"] | ESTree.Expression["type"];
type Evaluators = Partial<Record<ESTreeNodeType, (x: ESTree.Node) => void>>;

type BinaryOperatorHandle = (left: ESTree.Node, right: ESTree.Node) => void;

class Runtime {
  private readonly stack: any[] = [];

  private valueOf(name: string) {
    for (let i = this.stack.length - 1; i >= 1; i -= 2) {
      if (this.stack[i - 1] === name) {
        return this.stack[i];
      }
    }
    return () => (global as any)[name];
  }

  private once(fun: () => any) {
    let called = false;
    let value: any = undefined;

    return () => {
      if (!called) {
        value = fun();
        called = true;
      }
      return value;
    };
  }

  readonly binaryOperators: Record<string, BinaryOperatorHandle> = {
    "-": (left: ESTree.Node, right: ESTree.Node) => {
      this.evaluators[left.type]?.(left);
      this.evaluators[right.type]?.(right);
      const rightValue = this.stack.pop();
      this.stack.pop(); // right name
      const leftValue = this.stack.pop();
      this.stack.pop(); // left name
      this.stack.pop(); // invalid initializer

      this.stack.push(() => leftValue() - rightValue());
    },
  };

  readonly evaluators: Evaluators = {
    Identifier: (node: ESTree.Node) => {
      const { name } = node as ESTree.Identifier;
      const value = this.valueOf(name);
      this.stack.push(name, value);
    },

    BinaryExpression: (node: ESTree.Node) => {
      const { left, right, operator } = node as ESTree.BinaryExpression;
      this.binaryOperators[operator]?.(left, right);
    },

    MemberExpression: (node: ESTree.Node) => {
      const expression = node as ESTree.MemberExpression;
      const { object, property } = expression;
      this.evaluators[object.type]?.(object);
      this.evaluators[property.type]?.(property);
      this.stack.pop(); // invalid initializer of member
      const member = this.stack.pop();
      const instance = this.stack.pop();
      this.stack.push(() => {
        const self = instance();
        const method = self[member];
        return method.bind(self);
      });
    },

    CallExpression: (node: ESTree.Node) => {
      const expression = node as ESTree.CallExpression;
      const { callee, arguments: params } = expression;
      this.evaluators[callee.type as ESTreeNodeType]?.(callee);
      const args: any[] = [];
      for (const param of params) {
        this.evaluators[param.type]?.(param);
        args.push(this.stack.pop());
        this.stack.pop(); // name of value
      }

      const func = this.stack.pop();
      this.stack.push(() => func()(...args.map((item) => item())));
    },

    NewExpression: (node: ESTree.Node) => {
      const expression = node as ESTree.NewExpression;
      const { callee } = expression;
      this.evaluators[callee.type]?.(callee);
      const clazz = this.stack.pop();
      this.stack.pop(); // name of clazz
      this.stack.pop(); // invalid initializer

      this.stack.push(() => new (clazz())());
    },

    VariableDeclarator: (node: ESTree.Node) => {
      const declarator = node as ESTree.VariableDeclarator;
      const { id, init } = declarator;
      this.evaluators[id.type]?.(id);
      if (!init) {
        this.stack.push(undefined);
      } else {
        this.evaluators[init.type]?.(init);
        this.stack.push(this.once(this.stack.pop()));
      }
    },

    VariableDeclaration: (node: ESTree.Node) => {
      const declaration = node as ESTree.VariableDeclaration;
      for (const item of declaration.declarations) {
        this.evaluators[item.type]?.(item);
      }
    },

    ExpressionStatement: (node: ESTree.Node) => {
      const { expression } = node as ESTree.ExpressionStatement;
      this.evaluators[expression.type]?.(expression);
    },

    BlockStatement: (node: ESTree.Node) => {
      const block = node as ESTree.BlockStatement;
      console.log(block);
      for (const item of block.body) {
        this.evaluators[item.type]?.(item);
      }
    },

    FunctionDeclaration: (node: ESTree.Node) => {
      const declaration = node as ESTree.FunctionDeclaration;

      for (const param of declaration.params) {
        this.evaluators[param.type]?.(param);
      }

      const body = declaration.body;
      if (body) {
        this.evaluators[body.type]?.(body);
      }
    },
  };

  async eval(code: string) {
    const program = parse(code);
    program.body.forEach((node) => {
      this.evaluators[node.type]?.(node);
    });

    while (this.stack.length) {
      const value = await this.stack.pop()();
      const name = this.stack.pop();

      console.log(name, "=>", value);
    }
  }
}

export default function CodeBlock() {
  const { node } = useExtension(CodeBlock);
  // const textContent = node?.textContent;
  // const textContent = `
  // function bubble_Sort(paramA)
  // {
  //     var swapp;
  //     var n = paramA.length-1;
  //     var x=paramA;
  //     do {
  //         swapp = false;
  //         for (var i=0; i < n; i++)
  //         {
  //             if (x[i] < x[i+1])
  //             {
  //                var temp = x[i];
  //                x[i] = x[i+1];
  //                x[i+1] = temp;
  //                swapp = true;
  //             }
  //         }
  //         n--;
  //     } while (swapp);
  //  return x;
  // }

  // var n = 1000;
  // var array = [];
  // for (var i = 0; i < n; ++i) {
  //   array[i] = i;
  // }

  // var start = new Date();
  // bubble_Sort(array);
  // var end = new Date();

  // alert(end - start);
  // `;
  const textContent = `
  const a = new Date();  
  const b = new Date().getTime();
  const c = b - a.getTime();
  console.log(a, b, c);
  `;
  const [result, setResult] = useState<string>();

  useEffect(() => {
    try {
      const runtime = new Runtime();
      runtime.eval(textContent);
    } catch (e) {
      if (e instanceof SyntaxError) {
        setResult(e.message);
      }
    }
  }, [textContent]);

  return (
    <Extension>
      <pre>{result}</pre>
    </Extension>
  );
}

CodeBlock.node = {
  attrs: {
    language: {
      default: "javascript",
    },
  },
  content: "text*",
  marks: "",
  group: "block",
  code: true,
  defining: true,
  draggable: false,
  parseDOM: [
    { tag: "pre", preserveWhitespace: "full" },
    {
      tag: ".codeblock",
      preserveWhitespace: "full",
      contentElement: "code",
      getAttrs: (node) => ({
        language: (node as HTMLElement).dataset.language,
      }),
    },
  ],
  toDOM: (node) => [
    "div",
    { class: "codeblock", "data-language": node.attrs.language },
    ["pre", ["code", { spellCheck: "false" }, 0]],
  ],
} as NodeSpec;

CodeBlock.plugins = (type: NodeType) => [
  inputRules({
    rules: [textblockTypeInputRule(/^```$/, type)],
  }),
];
