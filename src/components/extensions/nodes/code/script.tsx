import produce from "immer";
import difference from "lodash.difference";
import { useEffect, useMemo, useRef, useState } from "react";

import Runtime, { Result } from "./runtime";

export const runtime = new Runtime();

type State = {
  result?: Result;
};

type Script = {
  get: (id: string) => State | undefined;
  activate: (code: string, id: string) => void;
  deactivate: (id: string) => void;
};

export function useScript(all: { id: string }[]) {
  const allRef = useRef<typeof all>();
  const [state, setState] = useState<Record<string, State>>({});

  useEffect(() => {
    const deleted = difference(allRef.current, all);
    deleted.length &&
      setState((ids) =>
        produce(ids, (draft) => {
          deleted.forEach(({ id }) => {
            delete draft[id];
          });
        })
      );
    allRef.current = all;
  }, [all]);

  useEffect(() => {
    return () => {
      allRef.current?.forEach(({ id }) => runtime.delete(id));
    };
  }, []);

  return useMemo<Script>(() => {
    return {
      get(id: string) {
        return state[id];
      },
      activate(code: string, id: string) {
        runtime.add(code, id).refresh(id, {
          onReturned: (closure) => {
            setState((state) =>
              produce(state, (draft) => {
                draft[id].result = closure.result;
              })
            );
          },
          onDisposed: (closure) => {
            console.log("TODO:", closure);
          },
        });
        setState((state) =>
          produce(state, (draft) => {
            draft[id] = {};
          })
        );
      },
      deactivate(id: string) {
        runtime.delete(id);
        setState((state) =>
          produce(state, (draft) => {
            delete draft[id];
          })
        );
      },
    };
  }, [state]);
}
