import React, { HTMLAttributes, useEffect, useRef } from "react";

import { NodeView as CodeView, useView as useCodeView } from "../code/view";
import { runtime } from "../code/script";

import { getFromRoute, Track } from "./utils";

export class NodeView extends CodeView {}

export function useView(name: string) {
  return useCodeView(name);
}

export function Wrapper({
  children: html,
  ...attrs
}: {
  children: string;
} & HTMLAttributes<HTMLDivElement>) {
  const divRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef(new Track("script"));

  useEffect(() => {
    const track = trackRef.current;
    return () => {
      for (const path in track.records) {
        runtime.delete(track.records[path]);
      }
    };
  }, []);

  useEffect(() => {
    if (!divRef.current) {
      return;
    }

    const wrapper = divRef.current;
    const track = trackRef.current;
    for (const { path, op } of track.updateDOM(wrapper, html)) {
      const route = path.split(",").map((x) => parseInt(x));
      const node = getFromRoute(wrapper, route);
      if (!node) {
        continue;
      }

      const id = track.records[path];
      switch (op) {
        case 1:
        case 0:
          runtime.add(node.textContent || "", id).refresh(id);
          break;
        case -1:
          runtime.delete(id);
      }
    }
  }, [html]);

  return <div {...attrs} ref={divRef} />;
}
