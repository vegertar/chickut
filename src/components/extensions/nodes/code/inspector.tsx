import React from "react";

import { Result } from "./runtime";

type Props = {
  result?: Result;
};

export default function Inspector({ result }: Props) {
  if (!result) {
    return null;
  }

  const { value, error } = result;
  return (
    <div className="inspector">
      {typeof value === "function" ? false : error?.toString() || value}
    </div>
  );
}
