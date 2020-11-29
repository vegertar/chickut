import React from "react";

import "./_index.scss";

export const light = "light";
export const dark = "dark";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  theme?: string;
};

export default function Theme({
  theme = light,
  className = "",
  children,
  ...configs
}: Props = {}) {
  return (
    <div {...configs} className={`${theme}${className ? " " + className : ""}`}>
      {children}
    </div>
  );
}
