import { rmSync } from "node:fs";

export default function teardown() {
  if (process.env.E2E_DATABASE_DIR) {
    rmSync(process.env.E2E_DATABASE_DIR, { recursive: true, force: true });
  }
}
