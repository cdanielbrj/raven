import "./trailer-preview.css";
import type { TimelineEvent } from "../../../../types";

export function TrailerPreview({
  entity,
}: {
  entity: TimelineEvent["entity"];
}) {
  const trailer = entity.metadata?.trailer;
  const embed = youtubeEmbedUrl(trailer);
  const fallback = trailer?.thumbnail ?? entity.coverUrl;
  return (
    <div className="featured-media" aria-hidden="true">
      {embed ? (
        <iframe
          className="featured-video"
          src={embed}
          title=""
          tabIndex={-1}
          allow="autoplay; encrypted-media"
        />
      ) : fallback ? (
        <img className="featured-static" src={fallback} alt="" />
      ) : (
        <div className="featured-fallback" />
      )}
    </div>
  );
}

function youtubeEmbedUrl(
  trailer: { id?: string | null; site?: string | null } | null | undefined,
): string | null {
  if (!trailer?.id || trailer.site?.toLowerCase() !== "youtube") return null;
  const id = encodeURIComponent(trailer.id);
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1&rel=0`;
}
