import { parseModule, ESTree } from "meriyah";
import findLastIndex from "lodash.findlastindex";

// Such performance! nearly 20 functions against 1 javascript instructor

const frame =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : setImmediate;

function parse(code?: string) {
  return parseModule(code || "");
}

type ESTreeNodeType = ESTree.Node["type"] | ESTree.Expression["type"];
type Evaluators = Partial<Record<ESTreeNodeType, (x: ESTree.Node) => void>>;
type Func = (...args: any[]) => any;

export default class Runtime {
  // functions which name starting with "___" are middle functions
  readonly stack: Func[] = [];

  valueOf(name: string) {
    const i = findLastIndex(this.stack, (item) => item.name === name);
    return i !== -1
      ? this.stack[i]
      : this.init(name, () => (global as any)[name]);
  }

  private init(name: string, func: Func, isMember = false) {
    let called = false;
    let value: any = undefined;

    return {
      [name]: (...args: any[]) => {
        if (!called) {
          value = func;
          called = true;
        }
        if (args.length === 1) {
          if (isMember) {
            value(args[0]);
          } else {
            value = args[0];
          }
        }
        return value();
      },
    }[name];
  }

  readonly binaryOperators = (
    op: string,
    left: ESTree.Node,
    right: ESTree.Node
  ) => {
    this.evaluators[left.type]?.(left);
    const leftValue = this.stack.pop();
    this.evaluators[right.type]?.(right);
    const rightValue = this.stack.pop();

    if (!leftValue || !rightValue) {
      throw new Error();
    }

    switch (op) {
      case "+": {
        const name = "___plus";
        this.stack.push(this.init(name, () => leftValue() + rightValue()));
        break;
      }
      case "-": {
        const name = "___minus";
        this.stack.push(this.init(name, () => leftValue() - rightValue()));
        break;
      }
      case "<": {
        const name = "___less_than";
        this.stack.push(this.init(name, () => leftValue() < rightValue()));
        break;
      }
      case ">": {
        const name = "___great_than";
        this.stack.push(this.init(name, () => leftValue() > rightValue()));
        break;
      }
    }
  };

  readonly evaluators: Evaluators = {
    Literal: (node: ESTree.Node) => {
      const { value } = node as ESTree.Literal;
      this.stack.push(() => value);
    },

    Identifier: (node: ESTree.Node) => {
      const { name } = node as ESTree.Identifier;
      this.stack.push(this.valueOf(name));
    },

    Property: (node: ESTree.Node) => {
      const { key, value } = node as ESTree.Property;
      this.evaluators[key.type]?.(key);
      const keyFunc = this.stack.pop();
      this.evaluators[value.type]?.(value);
      const valueFunc = this.stack.pop();

      if (!keyFunc || !valueFunc) {
        throw new Error();
      }

      keyFunc(valueFunc);
      this.stack.push(keyFunc);
    },

    BinaryExpression: (node: ESTree.Node) => {
      const { left, right, operator } = node as ESTree.BinaryExpression;
      this.binaryOperators(operator, left, right);
    },

    MemberExpression: (node: ESTree.Node) => {
      const { object, property, computed } = node as ESTree.MemberExpression;
      this.evaluators[object.type]?.(object);
      const instance = this.stack.pop();

      this.evaluators[property.type]?.(property);
      const member = this.stack.pop();

      if (instance && member) {
        const name = `___${instance.name}_${member.name}_`;
        this.stack.push(
          this.init(
            name,
            (...args: any[]) => {
              const self = instance();
              const fieldName = computed ? member() : member.name;
              if (args.length === 1) {
                self[fieldName] = args[0]();
              }
              const field = self[fieldName];
              if (typeof field === "function") {
                return field.bind(self);
              }
              return field;
            },
            true
          )
        );
      }
    },

    CallExpression: (node: ESTree.Node) => {
      const { callee, arguments: params } = node as ESTree.CallExpression;
      this.evaluators[callee.type as ESTreeNodeType]?.(callee);
      const func = this.stack.pop();
      const names = [func?.name];
      const args: any[] = [];
      for (const param of params) {
        this.evaluators[param.type]?.(param);
        const item = this.stack.pop();
        args.push(item);
        names.push(item?.name);
      }
      const name = names.join("_");
      this.stack.push(
        this.init(name, () => func?.()(...args.map((item) => item())))
      );
    },

    UpdateExpression: (node: ESTree.Node) => {
      const {
        argument: param,
        operator,
        prefix,
      } = node as ESTree.UpdateExpression;
      this.evaluators[param.type]?.(param);
      const value = this.stack.pop();
      if (!value) {
        throw new Error();
      }

      switch (operator) {
        case "++": {
          const name = `___${prefix ? "prefix_inc" : "inc"}__${value.name}`;
          this.stack.push(
            this.init(name, () => {
              let temp = value();
              const temp1 = prefix ? ++temp : temp++;
              value(() => temp);
              return temp1;
            })
          );

          break;
        }

        case "--": {
          const name = `___${prefix ? "prefix_dec" : "dec"}__${value.name}`;
          this.stack.push(
            this.init(name, () => {
              let temp = value();
              const temp1 = prefix ? --temp : temp--;
              value(() => temp);
              return temp1;
            })
          );

          break;
        }
      }
    },

    UnaryExpression: (node: ESTree.Node) => {
      const {
        operator,
        argument: param,
        prefix,
      } = node as ESTree.UnaryExpression;
      this.evaluators[param.type]?.(param);
      const value = this.stack.pop();

      if (!value) {
        throw new Error();
      }

      switch (operator) {
        case "-": {
          const name = `___neg_${value.name}`;
          this.stack.push(this.init(name, () => (prefix ? -value() : NaN)));
          break;
        }
      }
    },

    NewExpression: (node: ESTree.Node) => {
      const { callee } = node as ESTree.NewExpression;
      this.evaluators[callee.type]?.(callee);
      const clazz = this.stack.pop();
      const constructor = clazz?.();
      const name = `___${constructor.name}`;
      this.stack.push(this.init(name, () => new constructor()));
    },

    ArrayExpression: (node: ESTree.Node) => {
      const { elements } = node as ESTree.ArrayExpression;
      const index = this.stack.length;
      for (const element of elements) {
        const item = element as ESTree.Node;
        this.evaluators[item.type]?.(item);
      }
      const items = this.stack.splice(index);
      this.stack.push(() => items.map((item) => item()));
    },

    ObjectExpression: (node: ESTree.Node) => {
      const { properties } = node as ESTree.ObjectExpression;
      const index = this.stack.length;
      for (const element of properties) {
        const item = element as ESTree.Node;
        this.evaluators[item.type]?.(item);
      }
      const items = this.stack.splice(index);
      this.stack.push(() =>
        items.reduce(
          (all, item) => ({
            ...all,
            [item.name]: item(),
          }),
          {}
        )
      );
    },

    AssignmentExpression: (node: ESTree.Node) => {
      const { left, right, operator } = node as ESTree.AssignmentExpression;
      this.evaluators[left.type]?.(left);
      const leftValue = this.stack.pop();
      this.evaluators[right.type]?.(right);
      const rightValue = this.stack.pop();

      if (!leftValue || !rightValue) {
        throw new Error();
      }

      switch (operator) {
        case "=": {
          const name = `___set_${rightValue.name}_to_${leftValue.name}`;
          this.stack.push(this.init(name, () => leftValue(rightValue)));
          break;
        }

        case "+=": {
          const name = `___add_${rightValue.name}_to_${leftValue.name}`;
          this.stack.push(
            this.init(name, () => leftValue(() => leftValue() + rightValue()))
          );
          break;
        }
      }
    },

    VariableDeclarator: (node: ESTree.Node) => {
      const { id, init } = node as ESTree.VariableDeclarator;
      let value: Func | undefined;
      if (init) {
        this.evaluators[init.type]?.(init);
        value = this.stack.pop();
      }

      const index = this.stack.length;
      this.evaluators[id.type]?.(id);
      const variables = this.stack.slice(index);
      if (variables.length === 0) {
        throw new Error();
      }

      const name = `___init__${variables.map((item) => item.name).join("_")}`;
      this.stack.push(
        this.init(name, () => {
          const instance = value && value();
          variables.forEach((item) => item(() => instance));
        })
      );
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

    ReturnStatement: (node: ESTree.Node) => {
      const { argument: param } = node as ESTree.ReturnStatement;
      if (param) {
        this.evaluators[param.type]?.(param);
      } else {
        this.stack.push(() => undefined);
      }
    },

    BlockStatement: (node: ESTree.Node) => {
      const block = node as ESTree.BlockStatement;
      const index = this.stack.length;
      let returned = false;
      for (const item of block.body) {
        this.evaluators[item.type]?.(item);
        if (item.type === "ReturnStatement") {
          returned = true;
        }
      }
      const blocks = this.stack.splice(index);
      this.stack.push(() => {
        let i = 0;
        while (i + 1 < blocks.length) {
          blocks[i++]();
        }
        const result = blocks[i]?.();
        if (returned) {
          return result;
        }
      });
    },

    IfStatement: (node: ESTree.Node) => {
      const { test, consequent, alternate } = node as ESTree.IfStatement;

      this.evaluators[test.type]?.(test);
      const testFunc = this.stack.pop();

      this.evaluators[consequent.type]?.(consequent);
      const consequentFunc = this.stack.pop();

      let alternateFunc: Func | undefined;
      if (alternate) {
        this.evaluators[alternate.type]?.(alternate);
        alternateFunc = this.stack.pop();
      }

      if (testFunc && consequentFunc) {
        this.stack.push(() => {
          if (testFunc()) {
            consequentFunc();
          } else if (alternateFunc) {
            alternateFunc();
          }
        });
      }
    },

    ForStatement: (node: ESTree.Node) => {
      const { init, test, update, body } = node as ESTree.ForStatement;
      let initFunc: Func | undefined;
      let testFunc: Func | undefined;
      let updateFunc: Func | undefined;

      init && this.evaluators[init.type]?.(init);

      if (test) {
        this.evaluators[test.type]?.(test);
        testFunc = this.stack.pop();
      }

      if (update) {
        this.evaluators[update.type]?.(update);
        updateFunc = this.stack.pop();
      }

      this.evaluators[body.type]?.(body);
      const bodyFunc = this.stack.pop();

      if (init) {
        initFunc = this.stack.pop();
      }
      this.stack.push(() => {
        initFunc?.();
        while (!testFunc || testFunc()) {
          bodyFunc?.();
          updateFunc?.();
        }
      });
    },

    DoWhileStatement: (node: ESTree.Node) => {
      const { body, test } = node as ESTree.DoWhileStatement;
      this.evaluators[body.type]?.(body);
      const bodyFunc = this.stack.pop();
      this.evaluators[test.type]?.(test);
      const testFunc = this.stack.pop();

      if (!bodyFunc || !testFunc) {
        throw new Error();
      }

      this.stack.push(() => {
        do {
          bodyFunc();
        } while (testFunc());
      });
    },

    FunctionDeclaration: (node: ESTree.Node) => {
      const {
        id,
        params,
        body,
        async: asynced,
        generator,
      } = node as ESTree.FunctionDeclaration;

      const name = id?.name || "";
      const index = this.stack.length;
      for (const param of params) {
        this.evaluators[param.type]?.(param);
      }
      if (body) {
        this.evaluators[body.type]?.(body);
        const func = this.stack.pop();
        const closure = this.stack.splice(index);
        this.stack.push(
          this.init(name, () => (...args: any[]) => {
            for (let i = 0; i < args.length && i < params.length; ++i) {
              closure[i](() => args[i]);
            }
            return func?.();
          })
        );
      }
    },
  };

  async compile(code: string) {
    const program = parse(code);
    program.body.forEach((node) => {
      this.evaluators[node.type]?.(node);
    });
  }
}
