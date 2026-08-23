import { parseFragment } from "parse5";

export interface MalTrailerCandidate {
  source: "mal";
  provider: "youtube";
  id: string;
  title: string | null;
  malVideoId: string | null;
}

export type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class MalTrailerResolverError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "MalTrailerResolverError";
  }
}

export class MalTrailerResolver {
  constructor(private readonly fetcher: Fetcher = fetch) {}

  async resolve(malId: number): Promise<MalTrailerCandidate[]> {
    if (!Number.isInteger(malId) || malId < 1) {
      throw new MalTrailerResolverError("MAL id must be a positive integer");
    }

    const mediaPage = await this.fetch(
      `https://myanimelist.net/anime/${malId}`,
    );
    const videoPageUrl = videoPageUrlFor(malId, await mediaPage.text());
    const videoPage = await this.fetch(videoPageUrl);

    return parseTrailerCandidates(await videoPage.text());
  }

  private async fetch(url: string): Promise<Response> {
    const response = await this.fetcher(url, {
      headers: { accept: "text/html" },
    });
    if (response.ok) return response;

    throw new MalTrailerResolverError(
      `MAL page request failed with status ${response.status}`,
      response.status,
    );
  }
}

function videoPageUrlFor(malId: number, html: string): string {
  const root = parseFragment(html) as HtmlNode;
  const canonical = findElements(
    root,
    (element) =>
      element.tagName === "link" && attribute(element, "rel") === "canonical",
  )[0];
  const href = canonical ? attribute(canonical, "href") : null;
  if (!href) {
    throw new MalTrailerResolverError("MAL media page has no canonical URL");
  }

  const url = new URL(href);
  if (
    url.origin !== "https://myanimelist.net" ||
    !url.pathname.startsWith(`/anime/${malId}/`)
  ) {
    throw new MalTrailerResolverError(
      "MAL canonical URL does not match media id",
    );
  }
  return `${url.origin}${url.pathname.replace(/\/$/, "")}/video`;
}

export function parseTrailerCandidates(html: string): MalTrailerCandidate[] {
  const root = parseFragment(html) as HtmlNode;
  const promotionalSections = findElements(root, (element) =>
    hasClasses(element, "video-block", "promotional-video"),
  );

  return promotionalSections.flatMap((section) =>
    findElements(
      section,
      (element) =>
        hasClasses(element, "video-list") &&
        attribute(element, "href") !== null,
    )
      .map(toTrailerCandidate)
      .filter(
        (candidate): candidate is MalTrailerCandidate => candidate !== null,
      ),
  );
}

function toTrailerCandidate(element: HtmlNode): MalTrailerCandidate | null {
  const href = attribute(element, "href");
  if (!href) return null;

  const id = youtubeIdFromEmbedUrl(href);
  if (!id) return null;

  const image = findElements(element, (child) => child.tagName === "img")[0];
  return {
    source: "mal",
    provider: "youtube",
    id,
    title: image ? attribute(image, "data-title") : null,
    malVideoId: image ? attribute(image, "data-video-id") : null,
  };
}

function youtubeIdFromEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      ![
        "youtube.com",
        "www.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
      ].includes(url.hostname)
    )
      return null;
    const match = url.pathname.match(/^\/embed\/([^/]+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function findElements(
  node: HtmlNode,
  predicate: (element: HtmlNode) => boolean,
): HtmlNode[] {
  const results: HtmlNode[] = [];
  for (const child of node.childNodes ?? []) {
    if (child.tagName && predicate(child)) results.push(child);
    results.push(...findElements(child, predicate));
  }
  return results;
}

function hasClasses(element: HtmlNode, ...classes: string[]): boolean {
  const classNames = attribute(element, "class")?.split(/\s+/) ?? [];
  return classes.every((className) => classNames.includes(className));
}

function attribute(element: HtmlNode, name: string): string | null {
  return (
    element.attrs?.find((attribute) => attribute.name === name)?.value ?? null
  );
}

interface HtmlNode {
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
}
