"use client";

import { useState } from "react";
import type { AgentSpec } from "@/lib/types";

interface AgentSpecDisplayProps {
  spec: AgentSpec;
  onCopy: () => void;
}

export default function AgentSpecDisplay({ spec, onCopy }: AgentSpecDisplayProps) {
  const [copied, setCopied] = useState(false);

  // Defensive defaults for AI-generated JSON that may have missing fields
  const evidence = spec.evidence ?? { sourceCount: 0, platforms: [], signalScore: 0, trend: 'stable' as const };
  const userStories = spec.userStories ?? [];
  const techArch = spec.technicalArchitecture ?? { stack: [], stackRationale: '', databaseSchema: [], apiEndpoints: [], keyComponents: '' };
  const mvpScope = spec.mvpScope ?? { mustHave: [], skipForNow: [] };
  const sources = spec.sources ?? [];

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const markdown = formatSpecAsMarkdown(spec);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${spec.projectName}-spec.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Agent-Ready Spec: {spec.projectName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generated specification ready for your AI coding agent
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Markdown
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download .md
          </button>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Problem */}
        <section>
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Problem</h4>
          <p className="text-gray-900 dark:text-white">{spec.problem}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {evidence.sourceCount} sources
            </span>
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              Signal: {evidence.signalScore}/100
            </span>
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              Trend: {evidence.trend}
            </span>
          </div>
        </section>

        {/* User Stories */}
        <section>
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">User Stories</h4>
          <div className="space-y-3">
            {userStories.map((story, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  As <span className="text-primary-600 dark:text-primary-400">{story.persona}</span>, I want{" "}
                  <span className="text-primary-600 dark:text-primary-400">{story.capability}</span> so that{" "}
                  <span className="text-primary-600 dark:text-primary-400">{story.outcome}</span>
                </p>
                <ul className="mt-2 space-y-1">
                  {(story.acceptanceCriteria ?? []).map((criteria, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span className="text-gray-400 mt-0.5">&#9744;</span>
                      {criteria}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Technical Architecture */}
        <section>
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Technical Architecture</h4>

          {/* Stack */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Stack</p>
            <div className="flex flex-wrap gap-2">
              {techArch.stack.map((tech) => (
                <span key={tech} className="inline-flex items-center text-xs font-mono px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {tech}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{techArch.stackRationale}</p>
          </div>

          {/* Database Schema */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Database Schema</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">Table</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">Key Columns</th>
                    <th className="text-left py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Relations</th>
                  </tr>
                </thead>
                <tbody>
                  {(techArch.databaseSchema ?? []).map((table) => (
                    <tr key={table.table} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-900 dark:text-white">{table.table}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-600 dark:text-gray-400">{(table.keyColumns ?? []).join(", ")}</td>
                      <td className="py-2 text-xs text-gray-600 dark:text-gray-400">{table.relations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* API Endpoints */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">API Endpoints</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">Method</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">Route</th>
                    <th className="text-left py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {(techArch.apiEndpoints ?? []).map((endpoint, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                          endpoint.method === 'GET' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                          endpoint.method === 'PUT' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}>
                          {endpoint.method}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-900 dark:text-white">{endpoint.route}</td>
                      <td className="py-2 text-xs text-gray-600 dark:text-gray-400">{endpoint.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Component Tree */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Key Components</p>
            <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre">
              {techArch.keyComponents}
            </pre>
          </div>
        </section>

        {/* MVP Scope */}
        <section>
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">MVP Scope (48 hours)</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">Must Have</p>
              <ul className="space-y-1.5">
                {(mvpScope.mustHave ?? []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-gray-400 mt-0.5">&#9744;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">Skip for Now</p>
              <ul className="space-y-1.5">
                {(mvpScope.skipForNow ?? []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400 dark:text-gray-500 line-through">
                    <span className="mt-0.5">&#9744;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Agent Instructions */}
        <section>
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Agent Instructions (CLAUDE.md)</h4>
          <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">
            {spec.agentInstructions}
          </pre>
        </section>

        {/* Sources */}
        {sources.length > 0 && (
          <section>
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Sources</h4>
            <div className="space-y-2">
              {sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
                >
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-14">{source.platform}</span>
                  <span className="flex-1 text-gray-900 dark:text-white truncate">{source.title}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{source.score}pts / {source.comments}c</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Format an agent spec as a Markdown document for copy/download
 */
export function formatSpecAsMarkdown(spec: AgentSpec): string {
  const lines: string[] = [];

  lines.push(`# ${spec.projectName}`);
  lines.push('');
  lines.push('## Problem');
  lines.push(spec.problem);
  lines.push('');
  const ev = spec.evidence ?? { sourceCount: 0, platforms: [], signalScore: 0, trend: 'stable' };
  const ta = spec.technicalArchitecture ?? { stack: [], stackRationale: '', databaseSchema: [], apiEndpoints: [], keyComponents: '' };
  const mv = spec.mvpScope ?? { mustHave: [], skipForNow: [] };
  const sr = spec.sources ?? [];

  lines.push(`**Evidence**: ${ev.sourceCount} sources across ${(ev.platforms ?? []).join(', ')}`);
  lines.push(`**Signal strength**: ${ev.signalScore}/100 | **Trend**: ${ev.trend}`);
  lines.push('');

  lines.push('## User Stories');
  for (const story of spec.userStories ?? []) {
    lines.push(`- As ${story.persona}, I want ${story.capability} so that ${story.outcome}`);
    for (const criteria of story.acceptanceCriteria ?? []) {
      lines.push(`  - [ ] ${criteria}`);
    }
  }
  lines.push('');

  lines.push('## Technical Architecture');
  lines.push(`- **Stack**: ${(ta.stack ?? []).join(', ')}`);
  lines.push(`- **Why this stack**: ${ta.stackRationale}`);
  lines.push('');

  lines.push('### Database Schema');
  lines.push('| Table | Key Columns | Relations |');
  lines.push('|-------|------------|-----------|');
  for (const table of (ta.databaseSchema ?? [])) {
    lines.push(`| ${table.table} | ${(table.keyColumns ?? []).join(', ')} | ${table.relations} |`);
  }
  lines.push('');

  lines.push('### API Endpoints');
  lines.push('| Method | Route | Purpose |');
  lines.push('|--------|-------|---------|');
  for (const endpoint of (ta.apiEndpoints ?? [])) {
    lines.push(`| ${endpoint.method} | ${endpoint.route} | ${endpoint.purpose} |`);
  }
  lines.push('');

  lines.push('### Key Components');
  lines.push('```');
  lines.push(ta.keyComponents);
  lines.push('```');
  lines.push('');

  lines.push('## MVP Scope (48 hours)');
  lines.push('### Must Have');
  for (const item of (mv.mustHave ?? [])) {
    lines.push(`- [ ] ${item}`);
  }
  lines.push('');
  lines.push('### Skip for Now');
  for (const item of (mv.skipForNow ?? [])) {
    lines.push(`- [ ] ${item}`);
  }
  lines.push('');

  lines.push('## Agent Instructions');
  lines.push('> Paste this into your project\'s CLAUDE.md or .cursorrules');
  lines.push('');
  lines.push(spec.agentInstructions ?? '');
  lines.push('');

  if (sr.length > 0) {
    lines.push('## Sources');
    for (const source of sr) {
      lines.push(`- [${source.title}](${source.url}) — ${source.platform}, ${source.score} points, ${source.comments} comments`);
    }
  }

  return lines.join('\n');
}
