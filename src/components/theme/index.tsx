import React, { useState } from "react";

import "./_index.scss";

export const light = "light";
export const dark = "dark";

export default function Theme({ children }: { children?: React.ReactNode }) {
  const [theme, setTheme] = useState(light);

  return (
    <div className={theme}>
      <button
        onClick={() => {
          setTheme((x) => (x === light ? dark : light));
        }}
      >
        switch theme
      </button>
      {children}
    </div>
  );
}
