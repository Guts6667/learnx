import { stageAssessmentsApp } from '../../stage-assessments/app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await stageAssessmentsApp.fetch(request);
  },
};
