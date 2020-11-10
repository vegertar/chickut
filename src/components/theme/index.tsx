import React from "react";

import "./_index.scss";

export const light = "light";
export const dark = "dark";

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function Theme({
  className = light,
  children,
  ...configs
}: Props = {}) {
  return (
    <div {...configs} className={className}>
      {children}
    </div>
  );
}
