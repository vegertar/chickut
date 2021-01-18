import React, { useEffect, useRef, useState } from "react";
import { DiffDOM } from "diff-dom";

import Runtime, { Result } from "./runtime";
import produce from "immer";
import { NodeView } from "./view";
import difference from "lodash.difference";

export type Script = {
  id: string;
  code: string;
};

export function useScript(nodeViews: NodeView[], execute?: Script) {
  const [results, setResults] = useState<Record<string, Result>>({});
  const nodeViewsRef = useRef<NodeView[]>([]);
  const runtimeRef = useRef<Runtime>(
    new Runtime([], {
      onDisposed: console.log,
      onReturned: ({ id, result }) => {
        runtimeRef.current &&
          setResults((results) =>
            produce(results, (draft) => {
              draft[id] = result;
            })
          );
      },
    })
  );

  useEffect(() => {
    if (nodeViewsRef.current !== nodeViews) {
      for (const deled of difference(nodeViewsRef.current, nodeViews)) {
        runtimeRef.current.del(deled.id);
      }
      nodeViewsRef.current = nodeViews;
    }
    if (execute) {
      runtimeRef.current.add(execute.code, execute.id).evaluate();
    }
  }, [nodeViews, execute]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    return () => runtime.dispose();
  }, []);

  return results;
}
