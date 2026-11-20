// One-off maintenance: aligns saved stories with the built-in Maya / Leo examples.
const fs = require("node:fs")
const ts = require("typescript")
require("@next/env").loadEnvConfig(process.cwd(), true)
require.extensions[".ts"] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file,"utf8"), {
  compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020, esModuleInterop:true },
}).outputText,file)
require("../lib/npcRegistry.ts").refreshExistingNpcStories().then(npcs => {
  console.log("Updated background stories:",npcs.length)
  for (const npc of npcs) console.log(npc.name + ": " + npc.story)
}).catch(error => {
  console.error(String(error.message).replaceAll(process.env.OPENAI_API_KEY || "__no_key__", "[redacted]"))
  process.exitCode = 1
})
