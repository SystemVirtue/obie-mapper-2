import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

const TITLE = "Enter Projector Code — Side-Projection Mapping Suite";
const DESCRIPTION =
  "Enter a projector code to turn this device into a dedicated fullscreen output for a Side-Projection Mapping Suite session.";

export const Route = createFileRoute("/p/")({
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
  component: ProjectorCodePage,
});

function ProjectorCodePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  return (
    <main className="flex h-screen w-screen items-center justify-center bg-black px-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const token = code.trim();
          if (token) void navigate({ to: "/p/$token", params: { token } });
        }}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card/70 p-6 text-center backdrop-blur"
      >
        <h1 className="text-sm font-semibold text-foreground">Remote projector</h1>
        <p className="text-[11px] text-muted-foreground">
          No projector code specified. Copy the code from Remote Projector in the studio settings.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="pj_…"
          autoComplete="off"
          className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-center font-mono text-xs text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          Start output
        </button>
      </form>
    </main>
  );
}
