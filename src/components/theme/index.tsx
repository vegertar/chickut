import React from "react";

import "./_index.scss";

export const light = "light";
export const dark = "dark";
export const themes = { light, dark };
export type ThemeType = keyof typeof themes;

type Props = React.HTMLAttributes<HTMLDivElement> & {
  theme?: ThemeType;
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
