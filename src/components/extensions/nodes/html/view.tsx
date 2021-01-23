import React, { HTMLAttributes, useEffect, useRef } from "react";

import { NodeView as CodeView, useView as useCodeView } from "../code/view";

import { updateDOM } from "./utils";

export class NodeView extends CodeView {}

export function useView(name: string) {
  return useCodeView(name);
}

export function Wrapper({
  children: html,
  ...attrs
}: { children: string } & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const wrapper = ref.current;
    if (!wrapper.innerHTML) {
      wrapper.innerHTML = html;
    } else {
      // TODO:
      updateDOM(wrapper, html);
    }
  }, [html]);

  return <div {...attrs} ref={ref} />;
}
