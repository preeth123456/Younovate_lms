// HR Interviews hub (connected scheduling) - part 1
import React,{useCallback,useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {card,h2,sub,page,inp,btnP,btnG,th,td,Badge,Empty,Loading,Err,fmtDT} from '../../components/hr/hrUi';
import {hrGet,hrPost,hrPut} from '../../features/hr/hrApi';
import axios from 'axios';import {API_BASE_URL} from '../../config/api';
const auth=()=>({headers:{Authorization:`Bearer ${localStorage.getItem('token')||''}`}});
export default function HRInterviews(){
const [sp]=useSearchParams();
const [f,setF]=useState(sp.get('f')||'all');
const [ivs,setIvs]=useState([]);const [st,setSt]=useState('loading');const [err,setErr]=useState('');
const [cands,setCands]=useState([]);const [cos,setCos]=useState([]);const [jobs,setJobs]=useState([]);
const [show,setShow]=useState(false);
const [form,setForm]=useState({traineeId:sp.get('candidate')||'',company:'',job:'',role:'',round:'Round 1',date:'',time:'',interviewerName:'',mode:'online',meetingLink:'',location:'',notes:''});
const load=useCallback(async()=>{setSt('loading');setErr('');
try{const p={};if(f==='today'){const a=new Date();a.setHours(0,0,0,0);const b=new Date();b.setHours(23,59,59,999);p.from=a.toISOString();p.to=b.toISOString();}else if(f!=='all')p.status=f==='upcoming'?'scheduled':f;
const {data}=await axios.get(`${API_BASE_URL}/api/hr/interviews`,{...auth(),params:p});
let list=data.interviews||[];
if(f==='upcoming'){const n=new Date();list=list.filter((x)=>new Date(x.scheduledAt)>=n&&['scheduled','confirmed','rescheduled'].includes(x.status));}
setIvs(list);setSt('ok');
const c=await hrGet('/candidates',{limit:100});setCands(c.candidates||[]);
const cc=await hrGet('/companies',{limit:100});setCos(cc.companies||[]);
}catch(e){setErr(e.response?.data?.message||'Unable to load.');setSt('err');}},[f]);
useEffect(()=>{load();},[load]);
useEffect(()=>{if(form.company)hrGet('/jobs',{company:form.company,limit:50}).then((r)=>setJobs(r.jobs||[])).catch(()=>{});},[form.company]);

const save=async()=>{if(!form.traineeId||!form.date||!form.time)return alert('Candidate, date, time required');const at=new Date(`${form.date}T${form.time}`);if(at<new Date())return alert('Cannot schedule in the past');if(form.mode==='online'&&!form.meetingLink)return alert('Meeting link required');try{await hrPost('/interviews',{traineeId:form.traineeId,company:form.company||undefined,job:form.job||undefined,role:form.role,round:form.round,scheduledAt:at.toISOString(),interviewerName:form.interviewerName,mode:form.mode,meetingLink:form.meetingLink,location:form.location,notes:form.notes,status:'scheduled'});setShow(false);load();}catch(e){alert(e.response?.data?.message||'Failed');}};
const act=async(id,kind,body)=>{try{if(kind==='del')await axios.delete(`${API_BASE_URL}/api/hr/interviews/${id}`,auth());else if(body)await hrPut(`/interviews/${id}`,body);else await hrPut(`/interviews/${id}`,{status:'confirmed'});load();}catch(e){alert(e.response?.data?.message||'Failed');}};
return(<div style={page}>
<div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:14}}><div><h2 style={h2}>Interviews</h2><p style={sub}>Schedule and manage interviews</p></div><button type="button" style={btnP} onClick={()=>setShow(true)}>+ Schedule</button></div>
<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>{[['all','All'],['upcoming','Upcoming'],['today','Today'],['completed','Completed'],['cancelled','Cancelled'],['no_show','No Show']].map((t)=>(<button key={t[0]} type="button" onClick={()=>setF(t[0])} style={{...btnG,background:f===t[0]?'#3f7da0':'#fff',color:f===t[0]?'#fff':'#0F172A'}}>{t[1]}</button>))}</div>
{show&&(<div style={{...card,marginBottom:12}}><h3 style={{marginTop:0}}>Schedule</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
<select style={inp} value={form.traineeId} onChange={(e)=>setForm({...form,traineeId:e.target.value})}><option value="">Candidate *</option>{cands.map((c)=>(<option key={c._id} value={c._id}>{c.name}</option>))}</select>
<select style={inp} value={form.company} onChange={(e)=>setForm({...form,company:e.target.value,job:''})}><option value="">Company</option>{cos.map((c)=>(<option key={c._id} value={c._id}>{c.name}</option>))}</select>
<select style={inp} value={form.job} onChange={(e)=>setForm({...form,job:e.target.value})}><option value="">Job</option>{jobs.map((j)=>(<option key={j._id} value={j._id}>{j.title}</option>))}</select>
<input style={inp} placeholder="Role" value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})}/>
<input style={inp} placeholder="Round" value={form.round} onChange={(e)=>setForm({...form,round:e.target.value})}/>
<input style={inp} type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})}/>
<input style={inp} type="time" value={form.time} onChange={(e)=>setForm({...form,time:e.target.value})}/>
<input style={inp} placeholder="Interviewer" value={form.interviewerName} onChange={(e)=>setForm({...form,interviewerName:e.target.value})}/>
<select style={inp} value={form.mode} onChange={(e)=>setForm({...form,mode:e.target.value})}><option value="online">Online</option><option value="offline">Offline</option><option value="telephonic">Telephonic</option></select>
<input style={inp} placeholder="Meeting link" value={form.meetingLink} onChange={(e)=>setForm({...form,meetingLink:e.target.value})}/>
<input style={inp} placeholder="Location" value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}/>
</div><div style={{display:'flex',gap:8,marginTop:10}}><button type="button" style={btnP} onClick={save}>Save</button><button type="button" style={btnG} onClick={()=>setShow(false)}>Cancel</button></div></div>)}
{st==='loading'&&<Loading/>}{st==='err'&&<Err text={err} onRetry={load}/>}
{st==='ok'&&(ivs.length===0?<Empty text="No interviews found."/>:<div style={{...card,overflowX:'auto',padding:0}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:880}}><thead><tr><th style={th}>Candidate</th><th style={th}>Company</th><th style={th}>Round</th><th style={th}>When</th><th style={th}>Status</th><th style={th}>Actions</th></tr></thead><tbody>{ivs.map((v)=>(<tr key={v._id}><td style={td}><b>{v.trainee?.name||''}</b><div style={{fontSize:12,color:'#64748B'}}>{v.trainee?.email||''}</div></td><td style={td}>{v.company?.name||v.interviewerName||'—'}<div style={{fontSize:12,color:'#64748B'}}>{v.role||v.job?.title||''}</div></td><td style={td}>{v.round||v.type||'—'}</td><td style={td}>{fmtDT(v.scheduledAt)}</td><td style={td}><Badge v={v.status}/></td><td style={td}><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{v.meetingLink&&<a href={v.meetingLink} target="_blank" rel="noreferrer" style={{...btnG,textDecoration:'none'}}>Join</a>}{['scheduled','rescheduled'].includes(v.status)&&<button type="button" style={btnG} onClick={()=>act(v._id,'c')}>Confirm</button>}{['scheduled','confirmed','rescheduled'].includes(v.status)&&<><button type="button" style={btnG} onClick={()=>act(v._id,'u',{status:'completed'})}>Complete</button><button type="button" style={btnG} onClick={()=>act(v._id,'u',{status:'cancelled'})}>Cancel</button></>}<button type="button" style={btnG} onClick={()=>act(v._id,'del')}>Delete</button></div></td></tr>))}</tbody></table></div>)}
</div>);}