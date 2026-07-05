import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import listTestPlans from "./tools/list-test-plans";
import listTestCases from "./tools/list-test-cases";
import listDefects from "./tools/list-defects";
import createDefect from "./tools/create-defect";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "qualixa-mcp",
  title: "Qualixa MCP",
  version: "0.1.0",
  instructions:
    "Tools for Qualixa, the AI-powered Quality Intelligence Platform. Use these to browse projects, test plans, test cases, and defects, and to file new defects on behalf of the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjects, listTestPlans, listTestCases, listDefects, createDefect],
});
