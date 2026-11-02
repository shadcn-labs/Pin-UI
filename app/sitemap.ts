import { SPONSOR_ENABLED } from "@/sponsor/config";
import type { MetadataRoute } from "next";
import { LIBRARY } from "@/components/library/registry";
import { BLOCKS } from "@/lib/blocks";
import { SITE_URL } from "@/lib/site";

/**
 * Every page the site actually serves.
 *
 * The component and block pages are listed one by one rather than as a pattern, because
 * they are the pages worth finding — each is a component or a section somebody
 * might be searching for by name.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/components`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    ...LIBRARY.map((entry) => ({
      url: `${SITE_URL}/components/${entry.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    {
      url: `${SITE_URL}/blocx`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...BLOCKS.map((block) => ({
      url: `${SITE_URL}/blocx/${block.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    })),
    {
      url: `${SITE_URL}/testimonials`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    /* only while sponsoring is switched on (sponsor/config.ts) */
    ...(SPONSOR_ENABLED
      ? [
          {
            url: `${SITE_URL}/sponsor`,
            lastModified: now,
            changeFrequency: "monthly" as const,
            priority: 0.8,
          },
        ]
      : []),
    {
      url: `${SITE_URL}/waitlist`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
