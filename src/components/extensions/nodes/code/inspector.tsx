import React from "react";

import { Result } from "./runtime";

type Props = Result;

export default function Inspector({ value }: Props) {
  return (
    <div className="inspector">
      {typeof value === "function" ? false : value}
    </div>
  );
}
