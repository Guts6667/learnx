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

  it('routes only the offline runner implementation after Finance', () => {
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
    expect(backlog).toContain("V4-003A-R1 — Durcissement de l'oracle mécanique");
    expect(backlog).toContain('V4-003B-R1 — Nouvel audit autonome indépendant');
    expect(index).toContain('V4_003A_MECHANICAL_ORACLE_REPORT.md');
    expect(index).toContain('V4_003B_INDEPENDENT_AUDIT_REPORT.md');
    expect(index).toContain('V4_003A_R1_ORACLE_HARDENING_REPORT.md');
    expect(index).toContain('V4_003B_R1_INDEPENDENT_AUDIT_REPORT.md');
    expect(index).toContain('V4_003C_EXPERIMENT_IDENTITY_FREEZE_REPORT.md');
    expect(index).toContain('V4_003D_GATE4_FINANCE_ARBITRATION.md');
    expect(roadmap).toContain(
      "Le chemin critique ne possède qu'un ticket actif",
    );
    expect(manifest.activeExecutionQueue).toEqual(
      expect.objectContaining({
        currentResponsibleAgent: 'AGENT-DEV-LEARNX',
        currentTicket: 'V4-009C-S2',
        modelCallsAllowed: false,
      }),
    );
  });

  it('routes Totem through one validated design authority without opening implementation', () => {
    const index = read('docs/INDEX.md');
    const backlog = read('BACKLOG_V4.md');
    const roadmap = read('docs/V4_ROADMAP.md');
    const status = read('docs/V4_DOCUMENT_STATUS.md');
    const totem = read('docs/V4_TOTEM_DESIGN_IMPLEMENTATION_PLAN.md');

    expect(index).toContain('V4_TOTEM_DESIGN_IMPLEMENTATION_PLAN.md');
    expect(status).toContain('ACTIVE_DESIGN_AUTHORITY');
    expect(totem).toContain('DESIGN_VALIDATED');
    expect(totem).toContain('NOT_STARTED_NOT_AUTHORIZED_BY_THIS_DOCUMENT');
    expect(totem).toContain('320, 390, 720, 1440 et 1920');
    expect(totem).toContain('Aucun prix, capacité, allocation');

    for (const ticket of [
      'V4-016D',
      'V4-016E',
      'V4-016F',
      'V4-016H',
      'V4-016I',
    ]) {
      expect(backlog).toContain(`## ${ticket}`);
      expect(roadmap).toContain(ticket);
    }

    expect(roadmap).toContain('V4-003B-R1');
    expect(roadmap).toContain('DESIGN_VALIDATED_WAIT_GO');
  });
});
