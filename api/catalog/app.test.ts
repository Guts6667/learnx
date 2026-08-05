import type { MiddlewareHandler } from 'hono';

import {
  ProgramEnrollmentStatus,
  type Role,
} from '../../generated/prisma/client';
import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import type { ProgramDirectoryService } from '../../src/server/api/_lib/program-directory';
import type { ProgramEnrollmentService } from '../../src/server/api/_lib/program-enrollment';
import { createCatalogApp } from '../../src/server/api/catalog/app';

const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const programId = 'd53ae785-0d74-4a13-9e0c-f90675f9dd29';
const versionId = '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8';
const enrollmentId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const now = new Date('2026-08-05T10:00:00.000Z');

function authentication(
  id = userId,
  role: Role | string = 'USER',
): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Learner',
      email: 'learner@example.com',
      id,
      role: role as Role,
    });
    await next();
  };
}

function createServices() {
  const directoryService: ProgramDirectoryService = {
    listCatalog: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    listEnrolled: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  };
  const enrollment = {
    enrolledAt: now,
    id: enrollmentId,
    programId,
    status: ProgramEnrollmentStatus.ACTIVE,
    userId,
    version: { checksum: 'checksum', id: versionId, number: 1 },
    withdrawnAt: null,
  };
  const enrollmentService: ProgramEnrollmentService = {
    enroll: vi.fn().mockResolvedValue(enrollment),
    withdraw: vi.fn().mockResolvedValue({
      ...enrollment,
      status: ProgramEnrollmentStatus.WITHDRAWN,
      withdrawnAt: now,
    }),
  };
  return { directoryService, enrollmentService };
}

describe('catalog API', () => {
  it('exige une session authentifiée', async () => {
    const app = createCatalogApp();

    expect((await app.request('/api/catalog/programs')).status).toBe(401);
  });

  it('retourne une page bornée du catalogue pour le compte courant', async () => {
    const services = createServices();
    const app = createCatalogApp({
      authentication: authentication(),
      ...services,
    });

    const response = await app.request(
      '/api/catalog/programs?pageSize=5&search=psychologie',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
    expect(services.directoryService.listCatalog).toHaveBeenCalledWith({
      pageSize: 5,
      search: 'psychologie',
      userId,
    });
  });

  it('refuse les tailles non bornées et les capacités inconnues', async () => {
    const services = createServices();
    const invalidQueryApp = createCatalogApp({
      authentication: authentication(),
      ...services,
    });
    expect(
      (await invalidQueryApp.request('/api/catalog/programs?pageSize=51')).status,
    ).toBe(400);

    const forbiddenApp = createCatalogApp({
      authentication: authentication(userId, 'UNKNOWN'),
      ...services,
    });
    expect((await forbiddenApp.request('/api/catalog/programs')).status).toBe(
      403,
    );
  });

  it('liste uniquement les enrollments du compte et le statut demandé', async () => {
    const services = createServices();
    const app = createCatalogApp({
      authentication: authentication(),
      ...services,
    });

    const response = await app.request(
      '/api/me/programs?status=WITHDRAWN&pageSize=10',
    );

    expect(response.status).toBe(200);
    expect(services.directoryService.listEnrolled).toHaveBeenCalledWith({
      pageSize: 10,
      status: ProgramEnrollmentStatus.WITHDRAWN,
      userId,
    });
  });

  it('inscrit et désinscrit exclusivement le compte authentifié', async () => {
    const services = createServices();
    const app = createCatalogApp({
      authentication: authentication(),
      ...services,
    });

    const enrolled = await app.request(
      `/api/programs/${programId}/enrollment`,
      { method: 'POST' },
    );
    const withdrawn = await app.request(
      `/api/programs/${programId}/enrollment`,
      { method: 'DELETE' },
    );

    expect(enrolled.status).toBe(200);
    expect(withdrawn.status).toBe(200);
    expect(services.enrollmentService.enroll).toHaveBeenCalledWith(
      userId,
      programId,
    );
    expect(services.enrollmentService.withdraw).toHaveBeenCalledWith(
      userId,
      programId,
    );
    expect(await withdrawn.json()).toMatchObject({
      enrollment: {
        status: ProgramEnrollmentStatus.WITHDRAWN,
        withdrawnAt: now.toISOString(),
      },
    });
  });

  it('masque les programmes non publiables et valide les identifiants', async () => {
    const services = createServices();
    vi.mocked(services.enrollmentService.enroll).mockResolvedValue(null);
    const app = createCatalogApp({
      authentication: authentication(),
      ...services,
    });

    expect(
      (
        await app.request(`/api/programs/${programId}/enrollment`, {
          method: 'POST',
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request('/api/programs/not-a-uuid/enrollment', {
          method: 'POST',
        })
      ).status,
    ).toBe(400);
  });
});
