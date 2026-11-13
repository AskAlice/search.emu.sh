const {spawnSync}=require('node:child_process'),fs=require('node:fs');const trials=[];
for(let i=0;i<8;i++)for(const kind of ['app','fastify-only','node-only']) {
  const code=kind==='app'?"process.env.VERCEL='1';const f=require('fastify')();f.register(require('./dist/plugin').app);f.ready().then(()=>{console.log(JSON.stringify({ms:performance.now()-start,rss:process.memoryUsage().rss}));return f.close()})":kind==='fastify-only'?"const f=require('fastify')();f.get('/suggest',()=>[]);f.ready().then(()=>{console.log(JSON.stringify({ms:performance.now()-start,rss:process.memoryUsage().rss}));return f.close()})":"require('node:http');console.log(JSON.stringify({ms:performance.now()-start,rss:process.memoryUsage().rss}))";
  const r=spawnSync(process.execPath,['-e',"const start=performance.now();"+code],{encoding:'utf8'});
  if(r.status!==0)throw new Error(r.stderr);trials.push({kind,...JSON.parse(r.stdout.trim())});
}
fs.writeFileSync('benchmarks/results/startup.json',JSON.stringify({note:'Local process initialization, not Vercel cold-start measurements; skeletons do not provide application functionality',trials},null,2)+'\n');
console.log(trials);
