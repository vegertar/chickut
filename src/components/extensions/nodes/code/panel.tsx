import React from "react";
import { BsArrowClockwise, BsToggleOn, BsToggleOff } from "react-icons/bs";

type Props = {
  isToggleOn?: boolean;
  onToggle?: (isToggleOn: boolean) => void;
  onRefresh?: () => void;
};

export default function Panel({ isToggleOn, onToggle, onRefresh }: Props) {
  return (
    <div className="panel">
      <button>
        {isToggleOn ? (
          <BsToggleOn
            onClick={() => {
              onToggle?.(false);
            }}
          />
        ) : (
          <BsToggleOff
            onClick={() => {
              onToggle?.(true);
            }}
          />
        )}
      </button>

      {isToggleOn && (
        <button onClick={() => onRefresh?.()}>
          <BsArrowClockwise />
        </button>
      )}
    </div>
  );
}
