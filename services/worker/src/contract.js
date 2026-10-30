import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schema = JSON.parse(
  readFileSync(new URL('../../../contracts/job-message.v1.json', import.meta.url))
);
const ajv = new Ajv2020();
addFormats(ajv);
const validate = ajv.compile(schema);

export function parseJobMessage(body) {
  let message;
  try {
    message = JSON.parse(body);
  } catch {
    throw new Error('message body is not valid JSON');
  }

  if (!validate(message)) {
    throw new Error(`message violates contract: ${ajv.errorsText(validate.errors)}`);
  }

  const expectedPrefix = `uploads/${message.userId}/`;
  if (!message.s3Key.startsWith(expectedPrefix) || message.s3Key.includes('..')) {
    throw new Error('s3Key does not belong to the message user');
  }

  return message;
}