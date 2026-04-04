"use client";

import AgentSpecDisplay from "@/components/AgentSpecDisplay";
import { formatSpecAsMarkdown } from "@/components/AgentSpecDisplay";
import type { AgentSpec } from "@/lib/types";

interface SpecShowcaseClientProps {
  spec: AgentSpec;
}

export default function SpecShowcaseClient({ spec }: SpecShowcaseClientProps) {
  function handleCopy() {
    const markdown = formatSpecAsMarkdown(spec);
    navigator.clipboard.writeText(markdown);
  }

  return <AgentSpecDisplay spec={spec} onCopy={handleCopy} />;
}
