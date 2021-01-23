import trie from "trie-prefix-tree";
import * as dd from "diff-dom";

const diffDOM = new dd.DiffDOM();
const scriptNodeName = "SCRIPT";

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
  if (node.nodeName !== nodeName.toUpperCase()) {
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

function moveRoute(
  diff: dd.Diff,
  tree: ReturnType<typeof trie>,
  records: Records,
  step: number,
  results: Results
) {
  const c = diff.route[diff.route.length - 1];
  const prefix = diff.route.slice(0, diff.route.length - 1).join();
  const oldPaths = tree.getPrefix(prefix, false);

  for (const oldPath of oldPaths) {
    if (prefix && oldPath[prefix.length] && oldPath[prefix.length] !== ",") {
      continue;
    }

    const postfix = oldPath
      .slice(prefix.length)
      .split(",")
      .map((x) => parseInt(x));

    if (postfix[0] >= c) {
      // move backward 1 step
      postfix[0] += step;
      // update route record
      const newPath = prefix + postfix.join(",");
      const id = records[oldPath];
      delete records[oldPath];
      records[newPath] = id;
      tree.removeWord(oldPath).addWord(newPath);
      results.push({ op: 2, path: newPath });
    }
  }
}

function getTrackRoutes(target: Node, diff: dd.Diff, track: string) {
  const routes: Route[] = [];
  const node = getFromRoute(target, diff.route);
  node &&
    getRoutes(node, track).forEach((route) => {
      routes.push([...diff.route, ...route]);
    });
  return routes;
}

export function updateDOM(
  target: HTMLElement,
  innerHTML: string,
  records: Record<string, string> = {}, // route path -> id
  trackElement = scriptNodeName
) {
  const newElement = target.cloneNode() as HTMLElement;
  newElement.innerHTML = innerHTML;

  const diffs = diffDOM.diff(target, newElement);
  const tree = trie(Object.keys(records));
  const results: Results = [];

  for (const diff of diffs) {
    let flag = 0;

    switch (diff.action) {
      case "addTextElement":
        flag |= 1;
        break;
      case "addElement":
        flag |= 1;
        if (findElement(diff.element, trackElement)) {
          flag |= 2;
        }
        break;
      case "removeTextElement":
        flag |= 4;
        break;
      case "removeElement":
        flag |= 4;
        if (findElement(diff.element, trackElement)) {
          flag |= 8;
        }

        break;
      case "modifyTextElement":
        const node = getFromRoute(target, diff.route);
        if (node && node.parentElement?.nodeName === trackElement) {
          flag |= 16;
        }
        break;
    }

    if (flag & 3) {
      diffDOM.apply(target, [diff]);
      moveRoute(diff, tree, records, 1, results);
      if (flag & 2) {
        for (const route of getTrackRoutes(target, diff, trackElement)) {
          const path = route.join();
          const id = `${trackElement}-${new Date().getTime()}-${++seq}`;
          records[path] = id;
          tree.addWord(path);
          results.push({ path, op: 1 });
        }
      }
    } else if (flag & 12) {
      moveRoute(diff, tree, records, -1, results);
      if (flag & 8) {
        for (const route of getTrackRoutes(target, diff, trackElement)) {
          const path = route.join();
          delete records[path];
          tree.removeWord(path);
          results.push({ path, op: -1 });
        }
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

  return results;
}
