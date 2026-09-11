import { createFileRoute } from "@tanstack/react-router";

import RemoteOutput from "@/components/RemoteOutput";
import { LIVE_OUTPUT_TOKEN } from "@/lib/projector-link";

const TITLE = "Live Output — Side-Projection Mapping Suite";
const DESCRIPTION =
  "Permanent fullscreen projector endpoint for kiosk displays: always shows the latest mapped scene published from the studio, with no code or password.";

export const Route = createFileRoute("/liveoutput")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LiveOutputPage,
});

function LiveOutputPage() {
  return <RemoteOutput token={LIVE_OUTPUT_TOKEN} />;
}
