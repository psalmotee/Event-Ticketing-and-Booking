import { randomBytes, randomUUID } from 'node:crypto';

export function newId() {
  return randomUUID();
}

export function newReference() {
  return randomBytes(5)
    .toString('hex')
    .toUpperCase()
    .replace(/[01]/g, (character) => (character === '0' ? 'X' : 'Y'));
}
