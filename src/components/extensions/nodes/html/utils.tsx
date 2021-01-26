import trie from "trie-prefix-tree";
import * as dd from "diff-dom";

const diffDOM = new dd.DiffDOM();
const disabledScriptType = "text/disabled";

var seq = 0;

type Route = number[];
type Records = Record<string, string>; // route path -> id
type Results = { op: 2 | 1 | 0 | -1; path: string }[]; // 2: move, 1: add, 0: modify, -1: remove

export function getFromRoute(node: Node, route: number[]) {
  for (let i = 0; i < route.length; ++i) {
    if (!node.childNodes) {
      return null;
    }
    node = node.childNodes[route[i]];
  }
  return node;
}

export function getRoutes(node: Node, nodeName: string): Route[] {
  const routes: Route[] = [];
  if (node.nodeName !== nodeName) {
    for (let i = 0; i < node.childNodes.length; ++i) {
      for (const subRoute of getRoutes(node.childNodes[i], nodeName)) {
        routes.push([i, ...subRoute]);
      }
    }
  } else {
    routes.push([]);
  }
  return routes;
}

function findElement(element: dd.Element, name: string): boolean {
  if (element.nodeName === name) {
    return true;
  }
  if (element.nodeName === "#text") {
    return false;
  }

  const blockElement = element as dd.BlockElement;
  if (blockElement.childNodes) {
    for (const child of blockElement.childNodes) {
      if (findElement(child, name)) {
        return true;
      }
    }
  }

  return false;
}

export class Track {
  readonly nodeName: string;
  readonly records: Records = {};
  readonly tree = trie([]);

  constructor(nodeName: string) {
    this.nodeName = nodeName.toUpperCase();
  }

  private addRoute(target: Node, diff: dd.Diff, results: Results) {
    for (const route of this.getTrackRoutes(target, diff)) {
      const path = route.join();
      const id = `${this.nodeName}-${new Date().getTime()}-${++seq}`;
      this.records[path] = id;
      this.tree.addWord(path);
      results.push({ path, op: 1 });
    }
  }

  private removeRoute(target: Node, diff: dd.Diff, results: Results) {
    for (const route of this.getTrackRoutes(target, diff)) {
      const path = route.join();
      delete this.records[path];
      this.tree.removeWord(path);
      results.push({ path, op: -1 });
    }
  }

  private moveRoute(step: number, diff: dd.Diff, results: Results) {
    const c = diff.route[diff.route.length - 1];
    const prefix = diff.route.slice(0, diff.route.length - 1).join();
    const oldPaths = this.tree.getPrefix(prefix, false);

    for (const oldPath of oldPaths) {
      const morePrefix = prefix && oldPath[prefix.length];
      if (morePrefix && oldPath[prefix.length] !== ",") {
        continue;
      }

      const postfix = oldPath.slice(
        prefix.length + (morePrefix ? 1 /* , */ : 0)
      );
      const comma = postfix.indexOf(",");
      const n = parseInt(postfix);
      if (n >= c) {
        // update route record
        const newPath = `${prefix}${prefix && ","}${n + step}${
          comma < 0 ? "" : `${postfix.slice(comma)}`
        }`;
        const id = this.records[oldPath];
        delete this.records[oldPath];
        this.records[newPath] = id;
        this.tree.removeWord(oldPath).addWord(newPath);
        results.push({ op: 2, path: newPath });
      }
    }
  }

  private getTrackRoutes(target: Node, diff: dd.Diff) {
    const routes: Route[] = [];
    const node = getFromRoute(target, diff.route);
    node &&
      getRoutes(node, this.nodeName).forEach((route) => {
        routes.push([...diff.route, ...route]);
      });
    return routes;
  }

  private disableScript(element: Node) {
    element instanceof HTMLElement &&
      element.querySelectorAll("script").forEach((script) => {
        if (!script.getAttribute("type")) {
          script.setAttribute("type", disabledScriptType);
        }
      });
  }

  private restoreScript(element: Node) {
    (element as HTMLElement)
      .querySelectorAll(`script[type="${disabledScriptType}"]`)
      .forEach((script) => {
        script.removeAttribute("type");
      });
  }

  updateDOM(target: Node, innerHTML: string) {
    const newElement = target.cloneNode() as HTMLElement;
    newElement.innerHTML = innerHTML;

    // disable script to execute automatically
    this.disableScript(target);
    this.disableScript(newElement);

    const diffs = diffDOM.diff(target, newElement);
    const results: Results = [];

    for (const diff of diffs) {
      let flag = 0;

      switch (diff.action) {
        case "addTextElement":
          flag |= 1;
          break;
        case "addElement":
          flag |= 1;
          if (findElement(diff.element, this.nodeName)) {
            flag |= 2;
          }
          break;
        case "removeTextElement":
          flag |= 4;
          break;
        case "removeElement":
          flag |= 4;
          if (findElement(diff.element, this.nodeName)) {
            flag |= 8;
          }
          break;
        case "modifyTextElement":
          const node = getFromRoute(target, diff.route);
          if (node && node.parentElement?.nodeName === this.nodeName) {
            flag |= 16;
          }
          break;
      }

      if (flag & 3) {
        diffDOM.apply(target, [diff]);
        this.moveRoute(1, diff, results);
        if (flag & 2) {
          this.addRoute(target, diff, results);
        }
      } else if (flag & 12) {
        this.moveRoute(-1, diff, results);
        if (flag & 8) {
          this.removeRoute(target, diff, results);
        }
        diffDOM.apply(target, [diff]);
      } else {
        diffDOM.apply(target, [diff]);
        if (flag & 16) {
          results.push({
            path: diff.route.slice(0, diff.route.length - 1).join(),
            op: 0,
          });
        }
      }
    }

    this.restoreScript(target);
    return results;
  }
}
