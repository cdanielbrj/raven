import "./watch-provider.css";
import type { CSSProperties } from "react";
import type { Availability } from "../../types";

export function WatchProvider({
  availability,
  variant = "card",
}: {
  availability: Availability | null | undefined;
  variant?: "card" | "hero";
}) {
  if (!availability?.site || !availability.url) return null;
  const style = {
    "--provider-color": availability.color ?? "#a995f7",
  } as CSSProperties;
  return (
    <a
      className={`watch-provider ${variant === "hero" ? "hero-watch-provider" : ""}`}
      style={style}
      href={availability.url}
      target="_blank"
      rel="noreferrer"
      title={`Watch on ${availability.site}`}
    >
      {availability.icon ? (
        <img src={availability.icon} alt={availability.site} />
      ) : (
        <span>{availability.site}</span>
      )}
    </a>
  );
}
