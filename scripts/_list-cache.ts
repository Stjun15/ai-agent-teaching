import { lectureCacheDb } from "@/lib/db";

async function main() {
  const rows = await lectureCacheDb.list();
  for (const r of rows) {
    console.log(r.moduleId, r.step, r.content.length + "字", "model:", r.model);
  }
  console.log("共", rows.length, "条");
}

main();
