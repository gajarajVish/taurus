// Backend entry point - to be implemented
import { createServer } from './server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

async function main() {
  const server = await createServer();

  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
