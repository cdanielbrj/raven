import { describe, expect, it } from "vitest";
import {
  MalTrailerResolver,
  MalTrailerResolverError,
  parseTrailerCandidates,
} from "../src/api/external/mal/mal-trailer-resolver.js";

const trailerPage = `
  <div class="video-block music-video">
    <a class="video-list" href="https://www.youtube-nocookie.com/embed/music">Music</a>
  </div>
  <div class="video-block promotional-video mt16">
    <section>
      <a class="iframe js-fancybox-video video-list" href="https://www.youtube-nocookie.com/embed/first-video?autoplay=1">
        <img data-title="PV First &amp; Official" data-video-id="101">
      </a>
      <a class="iframe js-fancybox-video video-list" href="https://www.youtube-nocookie.com/embed/second-video">
        <img data-title="PV Second" data-video-id="102">
      </a>
      <a class="iframe js-fancybox-video video-list" href="https://example.test/embed/not-youtube">
        <img data-title="Not a trailer" data-video-id="103">
      </a>
    </section>
  </div>
`;

const mediaPage = `
  <head>
    <link rel="canonical" href="https://myanimelist.net/anime/21/One_Piece">
  </head>
`;

describe("MalTrailerResolver", () => {
  it("parses only promotional YouTube trailers in MAL presentation order", () => {
    expect(parseTrailerCandidates(trailerPage)).toEqual([
      {
        source: "mal",
        provider: "youtube",
        id: "first-video",
        title: "PV First & Official",
        malVideoId: "101",
      },
      {
        source: "mal",
        provider: "youtube",
        id: "second-video",
        title: "PV Second",
        malVideoId: "102",
      },
    ]);
  });

  it("requests the public video page by MAL id", async () => {
    const calls: string[] = [];
    const resolver = new MalTrailerResolver(async (input) => {
      calls.push(String(input));
      return new Response(calls.length === 1 ? mediaPage : trailerPage, {
        status: 200,
      });
    });

    await expect(resolver.resolve(21)).resolves.toHaveLength(2);
    expect(calls).toEqual([
      "https://myanimelist.net/anime/21",
      "https://myanimelist.net/anime/21/One_Piece/video",
    ]);
  });

  it("makes unavailable MAL pages explicit", async () => {
    const resolver = new MalTrailerResolver(
      async () => new Response(null, { status: 404 }),
    );

    await expect(resolver.resolve(21)).rejects.toEqual(
      expect.objectContaining<MalTrailerResolverError>({ statusCode: 404 }),
    );
  });
});
