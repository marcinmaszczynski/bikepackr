// Minimal Cloudflare Workers type — avoids @cloudflare/workers-types dependency
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
  }
}
