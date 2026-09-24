// HR Companies
import React,{useCallback,useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {card,h2,sub,page,inp,btnP,btnG,th,td,Badge,Empty,Loading,Err} from '../../components/hr/hrUi';
import {hrGet,hrPost,hrPut} from '../../features/hr/hrApi';
export default function HRCompanies(){
const nav=useNavigate();
const [search,setSearch]=useState('');const [deb,setDeb]=useState('');
const [d,setD]=useState(null);const [st,setSt]=useState('loading');const [err,setErr]=useState('');
const [show,setShow]=useState(false);const [form,setForm]=useState({name:'',industry:'',location:'',website:'',contactName:'',contactEmail:'',contactPhone:''});
const [detail,setDetail]=useState(null);
useEffect(()=>{const t=setTimeout(()=>setDeb(search),350);return()=>clearTimeout(t);},[search]);
const load=useCallback(async()=>{setSt('loading');try{const r=await hrGet('/companies',{search:deb,limit:25});setD(r);setSt('ok');}catch(e){setErr(e.response?.data?.message||'Unable to load.');setSt('err');}},[deb]);
useEffect(()=>{load();},[load]);
const save=async()=>{if(!form.name.trim())return;await hrPost('/companies',form);setShow(false);setForm({name:'',industry:'',location:'',website:'',contactName:'',contactEmail:'',contactPhone:''});load();};
const open=async(id)=>{const r=await hrGet('/companies/'+id);setDetail(r);};
const toggle=async(c)=>{await hrPut('/companies/'+c._id,{status:c.status==='active'?'inactive':'active'});load();if(detail)setDetail(await hrGet('/companies/'+detail.company._id));};
return(<div style={page}>
<div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:14}}><div><h2 style={h2}>Companies</h2><p style={sub}>Employers participating in placements</p></div><button type="button" style={btnP} onClick={()=>setShow(true)}>+ Add Company</button></div>
<div style={{...card,marginBottom:12}}><input style={{...inp,width:'100%'}} placeholder="Search name, industry, location…" value={search} onChange={(e)=>setSearch(e.target.value)}/></div>
{show&&(<div style={{...card,marginBottom:12}}><h3 style={{marginTop:0}}>New Company</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10}}>{[['name','Company *'],['industry','Industry'],['location','Location'],['website','Website'],['contactName','HR Contact'],['contactEmail','Email'],['contactPhone','Phone']].map((f)=>(<input key={f[0]} style={inp} placeholder={f[1]} value={form[f[0]]} onChange={(e)=>setForm({...form,[f[0]]:e.target.value})}/>))}</div><div style={{display:'flex',gap:8,marginTop:10}}><button type="button" style={btnP} onClick={save}>Save</button><button type="button" style={btnG} onClick={()=>setShow(false)}>Cancel</button></div></div>)}
{st==='loading'&&<Loading/>}{st==='err'&&<Err text={err} onRetry={load}/>}
{st==='ok'&&((d.companies||[]).length===0?<Empty text="No companies found."/>:<div style={{...card,overflowX:'auto',padding:0}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:820}}><thead><tr><th style={th}>Company</th><th style={th}>Location</th><th style={th}>Status</th><th style={th}>Open</th><th style={th}>Interviews</th><th style={th}>Offers</th><th style={th}>Placed</th><th style={th}>Actions</th></tr></thead><tbody>{(d.companies||[]).map((c)=>(<tr key={c._id}><td style={td}><b>{c.name}</b><div style={{fontSize:12,color:'#64748B'}}>{c.industry||''}</div></td><td style={td}>{c.location||'—'}</td><td style={td}><Badge v={c.status}/></td><td style={td}>{c.openPositions}</td><td style={td}>{c.interviews}</td><td style={td}>{c.offers}</td><td style={td}>{c.placements}</td><td style={td}><div style={{display:'flex',gap:6}}><button type="button" style={btnG} onClick={()=>open(c._id)}>View</button><button type="button" style={btnG} onClick={()=>toggle(c)}>{c.status==='active'?'Deactivate':'Activate'}</button></div></td></tr>))}</tbody></table></div>)}
{detail&&(<div style={{...card,marginTop:12}}><div style={{display:'flex',justifyContent:'space-between'}}><h3 style={{margin:0}}>{detail.company?.name}</h3><button type="button" style={btnG} onClick={()=>setDetail(null)}>Close</button></div><p style={sub}>Jobs: {(detail.jobs||[]).length} · Interviewed: {(detail.interviews||[]).length} · Offers: {(detail.offers||[]).length} · Placed: {(detail.placements||[]).length}</p><button type="button" style={btnG} onClick={()=>nav('/hr/jobs?company='+detail.company._id)}>View Jobs</button></div>)}
</div>);}
