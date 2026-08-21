import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('V4 document routing and assigned execution queue', () => {
  it('routes active work through the canonical status register', () => {
    const index = read('docs/INDEX.md');
    const status = read('docs/V4_DOCUMENT_STATUS.md');

    expect(index).toContain('V4_DOCUMENT_STATUS.md');
    expect(status).toContain('V4_EVIDENCE_SEMANTIC_ARBITRATION.md');
    expect(status).toContain('V4_CORRECTION_CONTRACT_AUTHORING_FUNNEL.md');
    expect(index).not.toContain('V4_009B_LIVE_GATE.md');
    expect(index).not.toContain('V4_009C_PREPARATION_REPORT.md');
    expect(index).not.toContain(
      'V4_EXECUTABLE_RUBRIC_GEMINI_PANEL_V2_PREPARATION.md',
    );
  });

  it.each([
    'docs/V4_009B_DIAGNOSTIC_EXTENSION_GATE.md',
    'docs/V4_009B_LIVE_GATE.md',
    'docs/V4_009C_PREPARATION_REPORT.md',
    'docs/V4_EXECUTABLE_RUBRIC_GEMINI_PANEL_V2_PREPARATION.md',
    'docs/V4_EXECUTABLE_RUBRIC_SONNET_5_BOUNDED_GATE_PREPARATION.md',
  ])('marks %s as a closed request before its historical body', (path) => {
    expect(read(path).slice(0, 700)).toContain('CLOSED_REQUEST');
  });

  it('assigns one current ticket and keeps calls disabled', () => {
    const index = read('docs/INDEX.md');
    const backlog = read('BACKLOG_V4.md');
    const roadmap = read('docs/V4_ROADMAP.md');
    const manifest = JSON.parse(
      read('docs/V4_AI_CORRECTION_PHASE_MANIFEST_V3.json'),
    ) as {
      activeExecutionQueue: {
        currentResponsibleAgent: string;
        currentTicket: string;
        modelCallsAllowed: boolean;
      };
    };

    expect(backlog).toContain('V4-003A — Corpus mécanique successeur');
    expect(backlog).toContain('V4-003B — Audit autonome indépendant');
    expect(index).toContain('V4_003A_MECHANICAL_ORACLE_REPORT.md');
    expect(roadmap).toContain(
      "Le chemin critique ne possède qu'un ticket actif",
    );
    expect(manifest.activeExecutionQueue).toEqual(
      expect.objectContaining({
        currentResponsibleAgent: 'AGENT-METHODOLOGIE',
        currentTicket: 'V4-003B',
        modelCallsAllowed: false,
      }),
    );
  });
});
