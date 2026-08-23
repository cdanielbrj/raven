import { describe, expect, it } from "vitest";
import {
  MalCatalogProvider,
  type MalCatalogProviderError,
} from "../src/api/external/mal/mal-catalog-provider.js";

describe("MalCatalogProvider", () => {
  it("uses the app client id and normalizes public catalog results", async () => {
    const provider = new MalCatalogProvider(
      "client-id",
      async (input, init) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/v2/anime");
        expect(url.searchParams.get("q")).toBe("frieren");
        expect(init?.headers).toMatchObject({
          "X-MAL-CLIENT-ID": "client-id",
        });
        return jsonResponse({
          data: [
            {
              node: {
                id: 52991,
                title: "Sousou no Frieren",
                alternative_titles: {
                  en: "Frieren: Beyond Journey's End",
                },
                main_picture: { large: "https://example.test/frieren.jpg" },
                status: "currently_airing",
                media_type: "tv",
                num_episodes: 28,
                start_date: "2023-09-29",
                genres: [{ id: 2, name: "Adventure" }],
              },
            },
          ],
        });
      },
    );

    await expect(
      provider.discover({ kind: "search", search: "frieren" }),
    ).resolves.toMatchObject([
      {
        provider: "mal",
        externalId: "52991",
        name: "Frieren: Beyond Journey's End",
        metadata: { genres: ["Adventure"], malId: 52991 },
      },
    ]);
  });

  it("exposes MAL request failures to the fallback chain", async () => {
    const provider = new MalCatalogProvider(
      "client-id",
      async () => new Response(null, { status: 503 }),
    );

    await expect(provider.discover({ kind: "current" })).rejects.toEqual(
      expect.objectContaining<MalCatalogProviderError>({ statusCode: 503 }),
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
