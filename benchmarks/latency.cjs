// Run after npm run build:ts. Fixture delays isolate application scheduling from WAN variance.
const fs = require('node:fs');
const http = require('node:http');
const { performance } = require('node:perf_hooks');
const Fastify = require('fastify');
const axios = require('axios');
const originalLog = console.log;
console.log = () => {}; console.error = () => {};
const sleep = (ms,signal) => new Promise((resolve,reject) => {
  const abort=()=>{clearTimeout(timer);reject(new Error('aborted fixture'))};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},ms);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
});
const summary = values => { const a = [...values].sort((a,b)=>a-b); return { n:a.length, p50_ms:+a[Math.floor(a.length*.5)].toFixed(3), p95_ms:+a[Math.min(a.length-1,Math.ceil(a.length*.95)-1)].toFixed(3), min_ms:+a[0].toFixed(3), max_ms:+a.at(-1).toFixed(3) }; };
const mode = process.argv[2] || 'baseline';
const result = { mode, node:process.version, cpu:require('node:os').cpus()[0].model, date:new Date().toISOString(), scenarios:[], framework:[] };
axios.defaults.adapter = async config => {
  const url = config.url;
  if (url.includes('google.com')) { await sleep(80,config.signal); return { data:JSON.stringify(['q',['google fixture'],[],[],{}]),config,status:200,headers:{} }; }
  if (url.includes('api.osv.dev')) { await sleep(240,config.signal); return { data:{summary:'Fixture vulnerability'},config,status:200,headers:{} }; }
  if (url.includes('duckduckgo.com')) { await sleep(240,config.signal); return {data:url.includes('/ac/')?[]:{},config,status:200,headers:{}}; }
  throw new Error('Unexpected network request in benchmark');
};
async function main() {
  let route = require('../dist/routes/suggest').default;
  if(mode==='baseline') {
    // Reproduce the previous wait-for-all policy using the SAME handler and dependencies.
    const Module=require('node:module'),path=require('node:path');
    const filename=path.resolve(__dirname,'../dist/routes/suggest.js');
    const code=fs.readFileSync(filename,'utf8');
    if(!code.includes('decisiveAnswer,'))throw new Error('Baseline benchmark anchor changed; review the policy adapter.');
    const baseline=new Module(filename,module);baseline.filename=filename;baseline.paths=Module._nodeModulePaths(path.dirname(filename));
    baseline._compile(code.replace('decisiveAnswer,',''),filename);route=baseline.exports.default;
  }
  result.sourceHash=require('node:crypto').createHash('sha256').update(fs.readFileSync(require.resolve('../dist/routes/suggest'))).digest('hex');
  const app = Fastify(); await app.register(route); await app.ready();
  for (const [name,q,expected] of [['local conversion','5 in in cm','12.7'],['bare custom bang','!orders','!orders'],['bang query autocomplete','!orders shoes','!orders google fixture'],['ordinary query','hello','google fixture'],['remote rich answer','CVE-2021-44228','Fixture vulnerability']]) {
    const samples=[]; for(let i=0;i<22;i++) { const start=performance.now();const r=await app.inject('/suggest?type=json&q='+encodeURIComponent(q));const elapsed=performance.now()-start; if(r.statusCode!==200||!r.body.includes(expected)) throw new Error(name+' lost expected result'); if(i>=2)samples.push(elapsed); }
    result.scenarios.push({name,google_fixture_ms:80,rich_fixture_ms:name==='remote rich answer'?240:0,...summary(samples),samples_ms:samples});
  }
  await app.close();
  // Identical pre-serialized payload and headers; no external calls or application providers.
  const payload = JSON.stringify(['hello',['hello world'],[],[],{'google:suggesttype':['QUERY']}]);
  const fast = Fastify();fast.get('/suggest',(_,reply)=>reply.type('application/json').send(payload));await fast.listen({port:0,host:'127.0.0.1'});
  const raw = http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(payload)});await new Promise(resolve=>raw.listen(0,'127.0.0.1',resolve));
  async function measure(server,concurrency) {
    const agent=new http.Agent({keepAlive:true,maxSockets:concurrency});let count=0;const samples=[];
    const request=()=>new Promise((resolve,reject)=>{const start=performance.now();http.get({host:'127.0.0.1',port:server.address().port,path:'/suggest?q=hello',agent},res=>{res.resume();res.on('end',()=>resolve(performance.now()-start));}).on('error',reject)});
    for(let i=0;i<100;i++)await request();
    const start=performance.now(); await Promise.all(Array.from({length:concurrency},async()=>{while(count++<1500)samples.push(await request());}));
    const duration=performance.now()-start;agent.destroy();return {...summary(samples),rps:Math.round(samples.length*1000/duration)};
  }
  for(const c of [1,16])for(let round=0;round<3;round++)for(const name of (round%2?['node:http','fastify']:['fastify','node:http']))result.framework.push({name,concurrency:c,round,...await measure(name==='fastify'?fast.server:raw,c)});
  await fast.close();await new Promise(resolve=>raw.close(resolve));
  fs.writeFileSync(`benchmarks/results/${mode}.json`,JSON.stringify(result,null,2)+'\n'); originalLog(JSON.stringify({mode,scenarios:result.scenarios.map(({samples_ms,...r})=>r),framework:result.framework},null,2));
}
main().catch(e=>{originalLog(e);process.exitCode=1});
