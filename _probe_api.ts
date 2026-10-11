import { assertArkApiKey } from "@/lib/agent/ark-config";
try {
  assertArkApiKey();
  console.log("API key OK");
} catch (e: unknown) {
  console.error((e as Error).message);
  process.exit(1);
}