import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { UPLOADS_ROOT } from '../../src/attachments/attachment-storage.js'

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// The root is computed from the file's own location, so moving the file once sent
// uploads to server/src/uploads while the tests still passed. Pin it.
describe('Attachment storage root', () => {
  it('is server/uploads/lab-02, where earlier uploads already live and git ignores them', () => {
    expect(UPLOADS_ROOT).toBe(path.join(SERVER_DIR, 'uploads', 'lab-02'))
  })
})
