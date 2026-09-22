import {createClient} from '@supabase/supabase-js';
export const configured=!!import.meta.env.VITE_SUPABASE_URL&&!import.meta.env.VITE_SUPABASE_URL.includes('YOUR_');
export const supabase=configured?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
export const API=(import.meta.env.VITE_API_URL||'http://localhost:8000').replace(/\/$/,'');
export async function api(path:string,method='GET',body?:unknown):Promise<any>{
 const session=await supabase?.auth.getSession();
 const token=session?.data.session?.access_token;
 if(!token)throw new Error('Sign in and connect Supabase to use this feature.');
 const isFile=body instanceof FormData;
 const response=await fetch(API+path,{method,headers:{Authorization:`Bearer ${token}`,...(!isFile&&body?{'Content-Type':'application/json'}:{})},body:body?(isFile?body:JSON.stringify(body)):undefined});
 const data=await response.json().catch(()=>({detail:'Server returned an unexpected response.'}));
 if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Request failed. Check your input and try again.');
 return data;
}
export async function streamAI(body:unknown,onUpdate:(text:string,sources:number[])=>void,signal:AbortSignal):Promise<{text:string;sources:number[]}>{
 const session=await supabase?.auth.getSession();
 const token=session?.data.session?.access_token;
 if(!token)throw new Error('Sign in and connect Supabase to use this feature.');
 const controller=new AbortController();
 const abort=()=>controller.abort();
 signal.addEventListener('abort',abort,{once:true});
 if(signal.aborted)controller.abort();
 let timer:ReturnType<typeof setTimeout>;
 const resetTimeout=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),120000)};
 resetTimeout();
 let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
 let text='',sources:number[]=[],done=false;
 try{
  const response=await fetch(API+'/ai/stream',{method:'POST',signal:controller.signal,
   headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(typeof data.detail==='string'?data.detail:'AI request failed.');}
  if(!response.body)throw new Error('Streaming is unavailable in this browser.');
  reader=response.body.getReader();
  const decoder=new TextDecoder();let buffer='';
  const consume=(line:string)=>{
   if(!line.trim())return;
   const event=JSON.parse(line);
   if(event.type==='error')throw new Error(event.detail||'AI response interrupted.');
   if(event.type==='sources'){sources=event.sources||[];onUpdate(text,sources)}
   if(event.type==='delta'){text+=event.text;onUpdate(text,sources)}
   if(event.type==='done'){done=true;console.info('Mentora AI timing (ms):',event.timing)}
  };
  while(!done){
   const chunk=await reader.read();resetTimeout();
   buffer+=decoder.decode(chunk.value,{stream:!chunk.done});
   let newline:number;
   while((newline=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,newline));buffer=buffer.slice(newline+1);if(done)break;}
   if(chunk.done){if(buffer.trim()&&!done)consume(buffer);break;}
  }
  if(!done||!text.trim())throw new Error('AI response ended before completion. Please try again.');
  return {text,sources};
 }catch(error){
  if(controller.signal.aborted&&!signal.aborted)throw new Error('AI response timed out. Please try again.');
  throw error;
 }finally{
  clearTimeout(timer!);signal.removeEventListener('abort',abort);
  if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();}
 }
}
export type Subject={id:string;name:string;topics:string[];exam:string};
export type Assignment={id:string;title:string;due:string;priority:string;done:boolean;brief:string;noteId?:string;tasks:{id:string;title:string;minutes:number;done:boolean}[]};
export type StudySession={id:string;subject:string;topic:string;date:string;minutes:number;done:boolean};
export type Flashcard={id:string;front:string;back:string;topic:string;due:string;interval:number};
export type Question={question:string;options:string[];correct:number;explanation:string;topic:string};
export type Attempt={id:string;date:string;score:number;total:number;topics:{topic:string;correct:boolean}[]};
export type Message={role:'user'|'assistant';text:string;sources?:number[]};
export type State={subjects:Subject[];assignments:Assignment[];sessions:StudySession[];cards:Flashcard[];attempts:Attempt[];chats:Record<string,Message[]>};
export const blank:State={subjects:[],assignments:[],sessions:[],cards:[],attempts:[],chats:{}};
export const uid=()=>{
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 // getRandomValues also works during phone testing over a local HTTP address.
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
export const day=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const plusDay=(n:number)=>{const d=new Date();d.setDate(d.getDate()+n);return day(d)};
export const displayDate=(d:string)=>new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric'});
export function topicStats(attempts:Attempt[]){const map:Record<string,{correct:number;total:number}>={};attempts.forEach(a=>a.topics.forEach(t=>{const v=map[t.topic]??={correct:0,total:0};v.total++;v.correct+=Number(t.correct)}));return Object.entries(map).map(([topic,v])=>({topic,...v,score:Math.round(v.correct/v.total*100)}));}
export function sample():State{return {...blank,subjects:[{id:uid(),name:'Object-Oriented Programming',topics:['Inheritance','Polymorphism','Encapsulation'],exam:plusDay(7)},{id:uid(),name:'Database Systems',topics:['SQL joins','Normalization','Indexes'],exam:plusDay(12)}],assignments:[{id:uid(),title:'Web Development report',due:new Date(plusDay(1)+'T18:00').toISOString(),priority:'High',done:false,brief:'Build and document a responsive website.',tasks:[]},{id:uid(),title:'Database coursework',due:new Date(plusDay(4)+'T18:00').toISOString(),priority:'Medium',done:false,brief:'Design a normalized relational database.',tasks:[]}],sessions:[{id:uid(),subject:'Object-Oriented Programming',topic:'Inheritance',date:day(),minutes:30,done:false},{id:uid(),subject:'Database Systems',topic:'SQL joins',date:day(),minutes:30,done:false}],cards:[{id:uid(),front:'What does inheritance allow a class to do?',back:'Reuse and extend behavior defined by another class.',topic:'Inheritance',due:day(),interval:0}],attempts:[]};}
