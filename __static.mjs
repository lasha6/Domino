import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const root = "D:/Mobile Games/Domino/public";
const T = { ".html":"text/html;charset=utf-8", ".js":"text/javascript;charset=utf-8",
            ".css":"text/css;charset=utf-8", ".json":"application/json", ".png":"image/png",
            ".webmanifest":"application/manifest+json" };
http.createServer((q,r)=>{
  const f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);r.end();return;}
    r.writeHead(200,{"Content-Type":T[path.extname(f)]||"application/octet-stream"}); r.end(d); });
}).listen(3099, ()=>console.log("static 3099"));
