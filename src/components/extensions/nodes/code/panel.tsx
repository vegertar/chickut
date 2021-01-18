import React from "react";
import { MdPlayArrow } from "react-icons/md";

type Props = {
  onExecute?: (event: React.MouseEvent) => void;
};

export default function Panel({ onExecute }: Props) {
  return (
    <div className="panel">
      <button onClick={onExecute}>
        <MdPlayArrow />
      </button>
    </div>
  );
}
