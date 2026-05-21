/// <reference path="../worker-integration.d.ts" />
/// <reference types="@cloudflare/vitest-pool-workers" />

import type { IntegrationEnv } from "../worker-integration";

declare module "cloudflare:workers" {
  interface Env extends IntegrationEnv {}
}

export type TestEnv = IntegrationEnv & TpaasEnv;
