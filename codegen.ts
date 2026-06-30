/**
 * GraphQL codegen config for the Supabase pg_graphql endpoint.
 *
 * Usage:
 *   bun run codegen
 *
 * Requires VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY in env (.env is loaded automatically).
 */
import type { CodegenConfig } from "@graphql-codegen/cli";

const url = `${process.env.VITE_SUPABASE_URL}/graphql/v1`;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const config: CodegenConfig = {
  overwrite: true,
  schema: [{ [url]: { headers: { apikey: key, Authorization: `Bearer ${key}` } } }],
  documents: ["src/admin/graphql/operations.ts"],
  generates: {
    "src/admin/graphql/generated.ts": {
      plugins: ["typescript", "typescript-operations"],
      config: { useTypeImports: true, scalars: { UUID: "string", Datetime: "string", JSON: "unknown", BigInt: "number" } },
    },
  },
};
export default config;
