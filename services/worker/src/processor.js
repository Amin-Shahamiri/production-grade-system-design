import { parseJobMessage } from './contract.js';

export function createProcessor({ storage, model, results, log = () => {} }) {
  return async function processMessage(body) {
    const { jobId, s3Key, userId, documentId } = parseJobMessage(body);

    const claim = await results.claim(jobId, { userId, documentId });
    if (claim.state === 'already_done') {
      log({ level: 'info', msg: 'duplicate delivery, job already done', jobId });
      return 'ack';
    }
    if (claim.state === 'in_progress') {
      log({ level: 'info', msg: 'job in progress elsewhere, leaving message', jobId });
      return 'retry';
    }

    try {
      const text = await storage.getObjectText(s3Key);
      const output = await model.summarize(text);
      await results.complete(jobId, output);
      log({ level: 'info', msg: 'job done', jobId, modelId: output.modelId, ...output.usage });
      return 'ack';
    } catch (err) {
      await results.fail(jobId, err.name || 'Error').catch(() => {});
      throw err;
    }
  };
}