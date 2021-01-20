import React from "react";

import { Result } from "./runtime";

type Props = Result;

export default function Inspector({ value, error }: Props) {
  return (
    <div className="inspector">
      {typeof value === "function" ? false : error?.toString() || value}
    </div>
  );
}
