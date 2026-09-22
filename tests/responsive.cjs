const path=require('node:path');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174'],{cwd:path.resolve(__dirname,'../frontend'),stdio:'ignore'});
(async()=>{let browser;try{
for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:5174');break}catch{await new Promise(r=>setTimeout(r,100))}}
browser=await chromium.launch({headless:true});
const report=[];const errors=[];const page=await browser.newPage({reducedMotion:"reduce"});page.on("pageerror",e=>errors.push(e.message));
for(const [width,height] of [[320,568],[390,844],[440,956],[768,1024],[1024,768],[1440,900],[2560,1440]]){
 await page.setViewportSize({width,height});
 await page.addInitScript(()=>{Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true})});
 await page.goto('http://127.0.0.1:5174');await page.evaluate(()=>localStorage.clear());await page.reload();
 const check=async(name)=>{const info=await page.evaluate(()=>({vw:innerWidth,sw:document.documentElement.scrollWidth}));if(info.sw>info.vw+1)throw Error(`${name} overflow at ${width}: ${JSON.stringify(info)}`);report.push(`${width}: ${name}`)};
 await check('login');
 const lw=await page.locator('.login').evaluate(e=>e.getBoundingClientRect().width);if(Math.abs(lw-width)>1)throw Error('Login not full-width');
 if(width===440||width===1440)await page.screenshot({path:path.join(__dirname,`login-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:'Explore preview',exact:true}).click();await page.getByRole('heading',{name:'Hello, Kaiff'}).waitFor();
 await check('overview');
 if(width===440||width===1440)await page.screenshot({path:path.join(__dirname,`workspace-${width}.png`),fullPage:true});
 const nav=async(name)=>{if(width<=1000)await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name,exact:true}).click()};
 for(const name of ['My subjects','Notes & PDF chat','Flashcards','Study planner','Learning progress','AI tutor','Exam practice','Assignments','Settings']){await nav(name);await check(name)}
 await nav('My subjects');await page.getByRole('button',{name:'Add subject',exact:true}).click();await check('subject modal');await page.getByLabel('Subject name').fill('Responsive test');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('heading',{name:'Responsive test',exact:true}).waitFor();
 await nav('Assignments');await page.getByRole('button',{name:'Add assignment',exact:true}).click();await check('assignment modal');await page.getByRole('button',{name:'Close form'}).click();

}
if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({checks:report.length,pageErrors:errors,viewports:7,lanUuidFallback:'passed'}));fs.writeFileSync(path.join(__dirname,'responsive-results.json'),JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
