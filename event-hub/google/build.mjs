import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const dir=new URL('./build/',import.meta.url);await fs.mkdir(dir,{recursive:true});
const files=['../core.mjs','../phone.mjs','../attendance.mjs','../visibility.mjs','../brands.mjs','sheet-schema.mjs','sheet-state.mjs','phone-sessions.mjs','source-refresh.mjs','calendar-sync.mjs','sheet-service.mjs'];
const code=[];
for(const file of files){const source=await fs.readFile(new URL(file,import.meta.url),'utf8');code.push(source.replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,''));}
code.push(await fs.readFile(new URL('./Runtime.gs',import.meta.url),'utf8'));
const compatible=ts.transpileModule(code.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None}}).outputText;
await fs.writeFile(new URL('Code.gs',dir),compatible);
await fs.copyFile(new URL('./appsscript.json',import.meta.url),new URL('appsscript.json',dir));
let html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../public/styles.css',import.meta.url),'utf8'),js=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^export \{\};?\s*$/gm,'');
html=html.replace('<link rel="stylesheet" href="/report/styles.css">','<style>'+css+'</style>').replace('<script defer type="module" src="/report/app.js"></script>','').replace('</body>','<script>'+js.replaceAll('</script','<\\/script')+'</script></body>');
html=html.replace('<head>','<head><base target="_top">').replace('href="/"','href="https://ads.aikpi.my/"');
await fs.writeFile(new URL('Index.html',dir),html);
console.log('Google Apps Script build ready: '+fileURLToPath(dir)+' (no members or credentials bundled)');
