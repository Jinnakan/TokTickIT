import { createServer } from 'node:http'
import { app as expressApp } from '../../src/app.js'

/**
 * supertest, given a bare Express app, listens on a random port on every
 * interface. On a developer machine other programs (Discord, Unity, Docker,
 * Adobe) hold 127.0.0.1 ports in that same range, and the OS lets a wildcard
 * listener and a specific 127.0.0.1 listener share a port number -- so the
 * request can reach the wrong process and fail with "Parse Error", "socket
 * hang up", or a timeout. Binding the test server to 127.0.0.1 makes the OS
 * refuse a taken port and pick another.
 *
 * Tests import `app` from here instead of src/app.ts.
 */
const server = createServer(expressApp)
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
server.unref()

export const app = server
