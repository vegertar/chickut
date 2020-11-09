import React from "react";

import "./_index.scss";

export const light = "light";
export const dark = "dark";

type Props = {
  name?: string;
  children?: React.ReactNode;
};

export default function Theme({ name = light, children }: Props = {}) {
  return <div className={name}>{children}</div>;
}
