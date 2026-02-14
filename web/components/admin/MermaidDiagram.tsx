"use client";

import { useEffect, useId, useMemo, useState } from "react";

type MermaidDiagramProps = {
  chart: string;
  className?: string;
};

type MermaidLike = {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    chart: string,
  ) => Promise<{ svg?: string } | string> | { svg?: string } | string;
};

function readIsDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const reactId = useId();
  const diagramId = useMemo(() => `mmd_${reactId.replace(/[:]/g, "_")}`, [reactId]);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    setIsDark(readIsDark());

    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(readIsDark());
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setSvg(null);
      setError(null);

      // Mermaid must run client-side; render to an SVG string to avoid SSR issues.
      const mermaidModule = await import("mermaid");
      const mermaid = ((mermaidModule as unknown as { default?: MermaidLike }).default ??
        (mermaidModule as unknown as MermaidLike)) as MermaidLike;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: isDark ? "dark" : "neutral",
        themeVariables: {
          background: "transparent",
        },
      });

      const rendered = await mermaid.render(diagramId, chart);
      const nextSvg = typeof rendered === "string" ? rendered : rendered.svg ?? null;
      if (!cancelled) setSvg(nextSvg);
    }

    render().catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      cancelled = true;
    };
  }, [chart, diagramId, isDark]);

  if (error) {
    return (
      <pre
        className={[
          "text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30",
          "border border-red-200 dark:border-red-900 rounded-lg p-3 overflow-x-auto",
          className ?? "",
        ].join(" ")}
      >
        {error}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className={["text-sm text-gray-500 dark:text-gray-400", className ?? ""].join(" ")}>
        Rendering trace…
      </div>
    );
  }

  return (
    <div
      className={className}
      // Mermaid outputs SVG; strict security level prevents unsafe HTML.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
