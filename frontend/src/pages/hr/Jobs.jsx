// HR Job Openings
import React,{useCallback,useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import toast from 'react-hot-toast';
import {card,h2,sub,page,inp,btnP,btnG,th,td,Badge,Empty,Loading,Err,fmtD} from '../../components/hr/hrUi';
import {hrGet,hrPost,hrPut,hrDel,hrExport} from '../../features/hr/hrApi';
export default function HRJobs(){
const [sp]=useSearchParams();
const [search,setSearch]=useState('');const [deb,setDeb]=useState('');
const [status,setStatus]=useState('');const [company,setCompany]=useState(sp.get('company')||'');
const [jobType,setJobType]=useState('');const [location,setLocation]=useState('');
const [pageN,setPageN]=useState(1);const [limitN,setLimitN]=useState(10);
const [cos,setCos]=useState([]);
const [stats,setStats]=useState(null);
const [d,setD]=useState(null);const [st,setSt]=useState('loading');const [err,setErr]=useState('');
const [show,setShow]=useState(false);
const blank={id:'',company:'',title:'',description:'',location:'',employmentType:'full-time',experienceMin:0,experienceMax:'',requiredSkills:'',openingsCount:1,ctc:'',eligibilityCriteria:'',deadline:'',status:'open'};
const [form,setForm]=useState(blank);
const [detail,setDetail]=useState(null);
const [sel,setSel]=useState([]);
const [menu,setMenu]=useState(null);
useEffect(()=>{const t=setTimeout(()=>{setDeb(search);setPageN(1);},350);return()=>clearTimeout(t);},[search]);
const load=useCallback(async()=>{
setSt('loading');setErr('');
try{
const r=await hrGet('/jobs',{search:deb||undefined,status:status||undefined,company:company||undefined,jobType:jobType||undefined,location:location||undefined,page:pageN,limit:limitN});
setD(r);setSt('ok');
const s=await hrGet('/jobs/stats');setStats(s.stats||null);
}catch(e){setErr(e.response?.data?.message||'Unable to load job openings.');setSt('err');}
},[deb,status,company,jobType,location,pageN,limitN]);
useEffect(()=>{load();},[load]);
useEffect(()=>{hrGet('/companies',{limit:100}).then((r)=>setCos(r.companies||[])).catch(()=>{});},[]);
useEffect(()=>{const h=()=>setMenu(null);document.addEventListener('click',h);return()=>document.removeEventListener('click',h);},[]);
const save=async()=>{
if(!form.company||!form.title.trim()){toast.error('Company and job title are required');return;}
const body={company:form.company,title:form.title.trim(),description:form.description,location:form.location,employmentType:form.employmentType,experienceMin:Number(form.experienceMin)||0,experienceMax:form.experienceMax===''?undefined:Number(form.experienceMax),requiredSkills:String(form.requiredSkills).split(',').map((s)=>s.trim()).filter(Boolean),openingsCount:Math.max(1,Number(form.openingsCount)||1),ctc:form.ctc,eligibilityCriteria:form.eligibilityCriteria,deadline:form.deadline||undefined,status:form.status};
try{
if(form.id){await hrPut('/jobs/'+form.id,body);toast.success('Job opening updated');}
else{await hrPost('/jobs',body);toast.success('Job opening created');}
setShow(false);setForm(blank);load();
}catch(e){toast.error(e.response?.data?.message||'Save failed');}
};
const open=async(id)=>{try{setDetail(await hrGet('/jobs/'+id));}catch(e){toast.error('Unable to load details');}};
const edit=(j)=>{setForm({id:j._id,company:j.company?._id||j.company||'',title:j.title||'',description:j.description||'',location:j.location||'',employmentType:j.employmentType||'full-time',experienceMin:j.experienceMin||0,experienceMax:j.experienceMax??'',requiredSkills:(j.requiredSkills||[]).join(', '),openingsCount:j.openingsCount||1,ctc:j.ctc||'',eligibilityCriteria:j.eligibilityCriteria||'',deadline:j.deadline?String(j.deadline).slice(0,10):'',status:j.status||'open'});setShow(true);setMenu(null);};
const setStatusOf=async(j,s)=>{try{await hrPut('/jobs/'+j._id,{status:s});toast.success('Status updated to '+s);setMenu(null);load();if(detail&&detail.job?._id===j._id)setDetail(await hrGet('/jobs/'+j._id));}catch(e){toast.error(e.response?.data?.message||'Update failed');}};
const del=async(j)=>{if(!window.confirm(`Delete "${j.title}"? This cannot be undone.`))return;try{await hrDel('/jobs/'+j._id);toast.success('Job opening deleted');setMenu(null);load();}catch(e){toast.error(e.response?.data?.message||'Delete failed');}};
const doExport=()=>{hrExport('jobs',{search:deb||'',status:status||'',company:company||'',jobType:jobType||'',location:location||''}).then(()=>toast.success('Export downloaded')).catch(()=>toast.error('Export failed'));};
const toggleSel=(id)=>setSel((p)=>p.includes(id)?p.filter((x)=>x!==id):[...p,id]);
const bulkClose=async()=>{try{await Promise.all(sel.map((id)=>hrPut('/jobs/'+id,{status:'closed'})));toast.success(sel.length+' opening(s) closed');setSel([]);load();}catch(e){toast.error('Bulk update failed');}};
const exp=(j)=>j.experienceMax!=null&&j.experienceMax!==''?`${j.experienceMin||0}-${j.experienceMax} yrs`:`${j.experienceMin||0}+ yrs`;
const tabs=d?.tabs||{};const facets=d?.facets||{};
const featured=(d?.jobs||[]).filter((j)=>j.status==='open').sort((a,b)=>(b.applications||0)-(a.applications||0))[0]||(d?.jobs||[])[0];
const recent=[...(d?.jobs||[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
return(<div style={page}>
<div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:14}}><div><h2 style={h2}>Job Openings</h2><p style={sub}>Manage job opportunities from partner companies</p></div><div style={{display:'flex',gap:8}}>{sel.length>0&&<button type="button" style={btnG} onClick={bulkClose}>Close {sel.length} selected</button>}<button type="button" style={btnG} onClick={doExport}>Export</button><button type="button" style={btnP} onClick={()=>{setForm(blank);setShow(true);}}>+ Add Job Opening</button></div></div>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:12}}>
{[['Total Job Openings',stats?.total],['Active Openings',stats?.active],['Total Applications',stats?.applications],['Interviews Scheduled',stats?.interviews],['Offers Released',stats?.offers],['Successful Placements',stats?.placements]].map((k)=>(<div key={k[0]} style={card}><div style={{fontSize:12,fontWeight:700,color:'#64748B'}}>{k[0]}</div><div style={{fontSize:26,fontWeight:800}}>{k[1]??'—'}</div></div>))}
</div>
<div style={{...card,marginBottom:12}}><input style={{...inp,width:'100%'}} placeholder="Search by job title, company, skills, location…" value={search} onChange={(e)=>setSearch(e.target.value)}/></div>
<div style={{...card,marginBottom:12,display:'flex',gap:8,flexWrap:'wrap'}}>
<select style={inp} value={company} onChange={(e)=>{setCompany(e.target.value);setPageN(1);}}><option value="">All Companies</option>{cos.map((c)=>(<option key={c._id} value={c._id}>{c.name}</option>))}</select>
<select style={inp} value={jobType} onChange={(e)=>{setJobType(e.target.value);setPageN(1);}}><option value="">All Types</option>{[...new Set([...(facets.jobTypes||[]),...((d?.jobs||[]).map((j)=>j.employmentType))])].filter(Boolean).map((t)=>(<option key={t} value={t}>{t}</option>))}</select>
<select style={inp} value={location} onChange={(e)=>{setLocation(e.target.value);setPageN(1);}}><option value="">All Locations</option>{[...new Set([...(facets.locations||[]),...((d?.jobs||[]).map((j)=>j.location))])].filter(Boolean).map((t)=>(<option key={t} value={t}>{t}</option>))}</select>
<select style={inp} value={status} onChange={(e)=>{setStatus(e.target.value);setPageN(1);}}><option value="">All Status</option><option value="open">Active</option><option value="closed">Closed</option><option value="draft">Draft</option><option value="expired">Expired</option></select>
</div>
<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
{[['','All Openings',tabs.all],['open','Active',tabs.open],['closed','Closed',tabs.closed],['draft','Draft',tabs.draft],['expired','Expired',tabs.expired]].map((t)=>(<button key={t[0]+t[1]} type="button" onClick={()=>{setStatus(t[0]);setPageN(1);}} style={{...btnG,background:status===t[0]?'#3f7da0':'#fff',color:status===t[0]?'#fff':'#0F172A'}}>{t[1]} ({t[2]??0})</button>))}
</div>
{show&&(<div style={{...card,marginBottom:12}}><h3 style={{marginTop:0}}>{form.id?'Edit Job Opening':'Add Job Opening'}</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10}}>
<select style={inp} value={form.company} onChange={(e)=>setForm({...form,company:e.target.value})}><option value="">Select company *</option>{cos.map((c)=>(<option key={c._id} value={c._id}>{c.name}</option>))}</select>
<input style={inp} placeholder="Job title *" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/>
<input style={inp} placeholder="Location" value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}/>
<select style={inp} value={form.employmentType} onChange={(e)=>setForm({...form,employmentType:e.target.value})}><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="internship">Internship</option><option value="contract">Contract</option></select>
<input style={inp} type="number" min="0" placeholder="Min exp (yrs)" value={form.experienceMin} onChange={(e)=>setForm({...form,experienceMin:e.target.value})}/>
<input style={inp} type="number" min="0" placeholder="Max exp (yrs)" value={form.experienceMax} onChange={(e)=>setForm({...form,experienceMax:e.target.value})}/>
<input style={inp} placeholder="Required skills (comma separated)" value={form.requiredSkills} onChange={(e)=>setForm({...form,requiredSkills:e.target.value})}/>
<input style={inp} type="number" min="1" placeholder="Vacancies" value={form.openingsCount} onChange={(e)=>setForm({...form,openingsCount:e.target.value})}/>
<input style={inp} placeholder="Salary / CTC" value={form.ctc} onChange={(e)=>setForm({...form,ctc:e.target.value})}/>
<input style={inp} type="date" value={form.deadline} onChange={(e)=>setForm({...form,deadline:e.target.value})}/>
<select style={inp} value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="open">Active</option><option value="closed">Closed</option><option value="expired">Expired</option></select>
</div>
<textarea style={{...inp,width:'100%',marginTop:10,minHeight:70}} placeholder="Job description" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/>
<input style={{...inp,width:'100%',marginTop:10}} placeholder="Eligibility criteria" value={form.eligibilityCriteria} onChange={(e)=>setForm({...form,eligibilityCriteria:e.target.value})}/>
<div style={{display:'flex',gap:8,marginTop:10}}><button type="button" style={btnP} onClick={save}>Save</button><button type="button" style={btnG} onClick={()=>{setShow(false);setForm(blank);}}>Cancel</button></div></div>)}
{st==='loading'&&<Loading text="Loading job openings…"/>}{st==='err'&&<Err text={err} onRetry={load}/>}
{st==='ok'&&(
<>
{(d.jobs||[]).length===0?<Empty text="No job openings found. Try adjusting search or filters, or add a new opening."/>:(
<div style={{...card,overflowX:'auto',padding:0}}>
<table style={{width:'100%',borderCollapse:'collapse',minWidth:980}}>
<thead><tr><th style={th}><input type="checkbox" checked={sel.length>0&&(d.jobs||[]).every((j)=>sel.includes(j._id))} onChange={(e)=>setSel(e.target.checked?(d.jobs||[]).map((j)=>j._id):[])}/></th><th style={th}>#</th><th style={th}>Job Title</th><th style={th}>Company</th><th style={th}>Location</th><th style={th}>Job Type</th><th style={th}>Experience</th><th style={th}>Applications</th><th style={th}>Status</th><th style={th}>Posted On</th><th style={th}>Actions</th></tr></thead>
<tbody>{(d.jobs||[]).map((j,i)=>(
<tr key={j._id}>
<td style={td}><input type="checkbox" checked={sel.includes(j._id)} onChange={()=>toggleSel(j._id)}/></td>
<td style={td}>{(pageN-1)*limitN+i+1}</td>
<td style={td}><b>{j.title}</b><div style={{fontSize:12,color:'#64748B'}}>{(j.requiredSkills||[]).slice(0,3).join(', ')}</div></td>
<td style={td}>{j.company?.name||'—'}</td>
<td style={td}>{j.location||'—'}</td>
<td style={td}>{j.employmentType||'—'}</td>
<td style={td}>{exp(j)}</td>
<td style={td}>{j.applications??0}</td>
<td style={td}><Badge v={j.status==='open'?'Active':j.status}/></td>
<td style={td}>{fmtD(j.createdAt)}</td>
<td style={{...td,position:'relative'}}>
<button type="button" style={btnG} onClick={(e)=>{e.stopPropagation();setMenu(menu===j._id?null:j._id);}}>⋮</button>
{menu===j._id&&(
<div onClick={(e)=>e.stopPropagation()} style={{position:'absolute',right:12,top:44,zIndex:20,background:'#fff',border:'1px solid #E2E8F0',borderRadius:10,boxShadow:'0 12px 28px rgba(15,23,42,.12)',minWidth:170,overflow:'hidden'}}>
<button type="button" onClick={()=>{open(j._id);setMenu(null);}} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 14px',border:'none',background:'#fff',cursor:'pointer',fontSize:13}}>View Details</button>
<button type="button" onClick={()=>edit(j)} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 14px',border:'none',background:'#fff',cursor:'pointer',fontSize:13}}>Edit</button>
{['draft','open','closed','expired'].filter((s)=>s!==j.status).map((s)=>(<button key={s} type="button" onClick={()=>setStatusOf(j,s)} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 14px',border:'none',background:'#fff',cursor:'pointer',fontSize:13}}>Mark {s==='open'?'Active':s}</button>))}
<button type="button" onClick={()=>del(j)} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 14px',border:'none',background:'#fff',cursor:'pointer',fontSize:13,color:'#B91C1C'}}>Delete</button>
</div>)}
</td>
</tr>))}
</tbody>
</table>
</div>)}
{(d.jobs||[]).length>0&&(
<>
<div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center',marginTop:12}}>
<div style={{display:'flex',gap:8,alignItems:'center',fontSize:13,color:'#64748B'}}>Rows per page
<select style={inp} value={limitN} onChange={(e)=>{setLimitN(Number(e.target.value));setPageN(1);}}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select>
<span>Page {d.page||pageN} of {d.pages||1} · {d.total||0} total</span></div>
<div style={{display:'flex',gap:8}}>
<button type="button" style={btnG} disabled={(d.page||pageN)<=1} onClick={()=>setPageN((p)=>Math.max(1,p-1))}>Prev</button>
<button type="button" style={btnG} disabled={(d.page||pageN)>=(d.pages||1)} onClick={()=>setPageN((p)=>p+1)}>Next</button>
</div>
</div>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:12,marginTop:12}}>
<div style={card}><h3 style={{margin:'0 0 8px'}}>Featured Opening</h3>
{featured?(<div><b>{featured.title}</b><div style={{fontSize:13,color:'#64748B'}}>{featured.company?.name||''} · {featured.location||''} · {featured.employmentType||''} · {exp(featured)}</div><p style={{fontSize:13}}>{String(featured.description||'').slice(0,180)}{String(featured.description||'').length>180?'…':''}</p><div style={{fontSize:12,color:'#64748B'}}>{(featured.requiredSkills||[]).join(', ')}</div><div style={{marginTop:10}}><button type="button" style={btnG} onClick={()=>open(featured._id)}>View Details</button></div></div>):(<p style={sub}>No openings to feature yet.</p>)}
</div>
<div style={card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h3 style={{margin:0}}>Recent Job Openings</h3><button type="button" style={btnG} onClick={()=>{setStatus('');setSearch('');setDeb('');setCompany('');setJobType('');setLocation('');setPageN(1);}}>View All</button></div>
{recent.length===0?(<p style={sub}>No recent openings.</p>):recent.map((r)=>(<div key={r._id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'8px 0',borderBottom:'1px solid #F1F5F9',fontSize:13}}><span><b>{r.title}</b> · {r.company?.name||''}</span><span style={{color:'#64748B'}}>{fmtD(r.createdAt)}</span></div>))}
</div>
</div>
</>
)}
</>)}
{detail&&(<div style={{...card,marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><h3 style={{margin:0}}>{detail.job?.title} @ {detail.job?.company?.name}</h3><button type="button" style={btnG} onClick={()=>setDetail(null)}>Close</button></div>
<p style={sub}>{detail.job?.location||''} · {detail.job?.employmentType||''} · {detail.job?.ctc||''} · <Badge v={detail.job?.status}/> · Posted {fmtD(detail.job?.createdAt)}{detail.job?.deadline?` · Deadline ${fmtD(detail.job.deadline)}`:''}</p>
<p style={{fontSize:13}}>{detail.job?.description||'No description.'}</p>
<div style={{fontSize:13}}>Skills: {(detail.job?.requiredSkills||[]).join(', ')||'—'} · Vacancies: {detail.job?.openingsCount||1}</div>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginTop:12}}>
<div><b>Applications</b>{(detail.interviews||[]).slice(0,5).map((i)=>(<div key={i._id} style={{fontSize:12}}>{i.trainee?.name||''} · Interview {i.status}</div>))}{(detail.offers||[]).slice(0,5).map((o)=>(<div key={o._id} style={{fontSize:12}}>{o.candidate?.name||''} · Offer {o.status}</div>))}</div>
<div><b>Eligible ({(detail.eligible||[]).length})</b>{(detail.eligible||[]).slice(0,8).map((e)=>(<div key={e._id} style={{fontSize:12}}>{e.name} · match {e.matchCount??0}</div>))}</div>
</div>
<div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}><button type="button" style={btnP} onClick={()=>edit(detail.job)}>Edit</button>{detail.job?.status!=='closed'&&<button type="button" style={btnG} onClick={()=>setStatusOf(detail.job,'closed')}>Close Opening</button>}</div>
</div>)}
</div>);}
