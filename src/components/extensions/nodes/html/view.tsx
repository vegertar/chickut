import React, { useEffect, useRef } from "react";
import { DiffDOM } from "diff-dom";

import { NodeView as CodeView, useView as useCodeView } from "../code/view";

export class NodeView extends CodeView {}

export function useView(name: string) {
  return useCodeView(name);
}

const dd = new DiffDOM();

function update(oldElement: HTMLElement, html: string) {
  const newElement = oldElement.cloneNode() as HTMLElement;
  newElement.innerHTML = html;
  if (newElement.innerHTML === html) {
    // TODO: detect script diff
    dd.apply(oldElement, dd.diff(oldElement, newElement));
  } else {
    // TODO: handle error for invalid HTML
  }
}

export function Wrapper({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const wrapper = ref.current;
    if (!wrapper.innerHTML) {
      wrapper.innerHTML = html;
    } else {
      update(wrapper, html);
    }
  }, [html]);

  return <div className="wrapper" ref={ref}></div>;
}
