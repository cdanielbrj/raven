import { useEffect, useState, type CSSProperties } from "react";
import type { Availability, Entity, TimelineEvent, Trailer } from "../types";

export function Cover({
  entity,
}: {
  entity: Pick<Entity, "coverUrl"> | TimelineEvent["entity"];
}) {
  return (
    <div className="mini-cover">
      {entity.coverUrl ? <img src={entity.coverUrl} alt="" /> : <span>R</span>}
    </div>
  );
}

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

export function HeroBackground({
  entity,
  reduced,
}: {
  entity: TimelineEvent["entity"];
  reduced: boolean;
}) {
  const trailer = youtubeTrailerUrl(entity.metadata?.trailer);
  const banner = entity.metadata?.bannerImage;
  const video = trailer && !reduced;
  return (
    <div className="hero-background" aria-hidden="true">
      {video ? (
        <iframe
          className="hero-video"
          src={trailer}
          title=""
          tabIndex={-1}
          allow="autoplay; encrypted-media"
        />
      ) : banner ? (
        <img className="hero-static" src={banner} alt="" />
      ) : (
        <div
          className="hero-fallback"
          style={
            entity.coverUrl
              ? { backgroundImage: `url(${entity.coverUrl})` }
              : undefined
          }
        />
      )}
      <div className="hero-scrim" />
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return <p className="error-message">{message}</p>;
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function youtubeTrailerUrl(trailer: Trailer | null | undefined): string | null {
  if (trailer?.site?.toLowerCase() !== "youtube" || !trailer.id) return null;
  const id = encodeURIComponent(trailer.id);
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1&rel=0&modestbranding=1`;
}
