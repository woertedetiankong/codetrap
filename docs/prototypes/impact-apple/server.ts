import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const server=Bun.serve({hostname:'127.0.0.1',port:4760,async fetch(request){
  const url=new URL(request.url);
  let relative:string;
  try {relative=decodeURIComponent(url.pathname);} catch {return new Response('Bad request',{status:400});}
  const path=resolve(root,`.${relative==='/'?'/index.html':relative}`);
  if(!path.startsWith(root.endsWith(sep)?root:root+sep))return new Response('Not found',{status:404});
  const file=Bun.file(path);if(!await file.exists())return new Response('Not found',{status:404});
  return new Response(file,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}});
console.log(`Impact prototype: ${server.url}`);
