"use client";

import { useEffect, useId, useState } from "react";

export function MermaidBlock({ chart }: { chart: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "_");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "dark",
          themeVariables: {
            darkMode: true,
            background: "#0a0a0a",
            primaryColor: "#0f2847",
            primaryTextColor: "#f3f8fc",
            primaryBorderColor: "#4fd8ff",
            lineColor: "#4fd8ff",
            secondaryColor: "#132338",
            tertiaryColor: "#0c1d33",
            mainBkg: "#0f2847",
            nodeBorder: "#4fd8ff",
            clusterBkg: "#0c1d33",
            clusterBorder: "#27486e",
            titleColor: "#4fd8ff",
            edgeLabelBackground: "#0f2847",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: "12px",
          },
        });

        const cleanChart = chart.trim();
        const renderId = `mermaid_diag_${id}_${Date.now()}`;
        const { svg: output } = await mermaid.render(renderId, cleanChart);

        if (isMounted) {
          setSvg(output);
          setError(null);
        }
      } catch (err) {
        console.error("Mermaid diagram rendering error:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    renderMermaid();

    return () => {
      isMounted = false;
    };
  }, [chart, id]);

  return (
    <figure className="my-8 border border-line/25 bg-panel/30 p-4">
      <div className="mb-3 flex items-center justify-between border-b border-line/15 pb-2 text-[11px] font-mono tracking-wider text-ink-500">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          ARCHITECTURE DIAGRAM
        </span>
        <button
          type="button"
          onClick={() => setShowCode(!showCode)}
          className="cursor-pointer text-ink-400 hover:text-accent transition-colors"
        >
          {showCode ? "[VIEW DIAGRAM]" : "[VIEW SOURCE]"}
        </button>
      </div>

      {showCode ? (
        <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-ink-300 font-mono">
          {chart}
        </pre>
      ) : error ? (
        <div className="overflow-x-auto p-4 text-xs text-rose-300">
          <p className="font-semibold text-rose-400">Diagram rendering failed:</p>
          <pre className="mt-2 text-ink-400 font-mono">{chart}</pre>
        </div>
      ) : svg ? (
        <div
          className="flex justify-center overflow-x-auto py-2 [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex items-center justify-center py-12 text-xs font-mono text-ink-500">
          Rendering diagram...
        </div>
      )}
    </figure>
  );
}
