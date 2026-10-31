import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1/frontend/package.json');
const esbuild=require('esbuild'),root=fileURLToPath(new URL('.',import.meta.url));
const result=await esbuild.build({absWorkingDir:root,entryPoints:['atlas.js'],outfile:'atlas.bundle.js',bundle:true,format:'esm',minify:true,target:['es2022'],legalComments:'eof',metafile:true});
writeFileSync(new URL('bundle-meta.json',import.meta.url),JSON.stringify(result.metafile,null,2));
console.log(JSON.stringify({bundleBytes:result.metafile.outputs['atlas.bundle.js'].bytes,inputCount:Object.keys(result.metafile.inputs).length}));
