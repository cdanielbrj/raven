import "./discovery-controls.css";
import type { FormEvent } from "react";

export function DiscoveryControls({
  mode,
  search,
  onSearchChange,
  onSubmit,
  onModeChange,
}: {
  mode: "current" | "next-season";
  search: string;
  onSearchChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onModeChange: (mode: "current" | "next-season") => void;
}) {
  return (
    <>
      <form className="search" onSubmit={onSubmit}>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search anime"
          aria-label="Search anime"
        />
        <button>Search</button>
      </form>
      <div className="filters">
        {(["current", "next-season"] as const).map((item) => (
          <button
            key={item}
            className={mode === item ? "filter active" : "filter"}
            onClick={() => onModeChange(item)}
          >
            {item.replace("-", " ")}
          </button>
        ))}
      </div>
    </>
  );
}
