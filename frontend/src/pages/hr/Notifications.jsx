// HR Notifications - reuses /api/notifications, deep-links to HR entities
import React,{useCallback,useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import axios from 'axios';import {API_BASE_URL} from '../../config/api';
import {card,h2,sub,page,btnG,Empty,Loading,Err} from '../../components/hr/hrUi';
const API=API_BASE_URL;
const hdr=()=>({headers:{Authorization:`Bearer ${localStorage.getItem('token')||sessionStorage.getItem('token')||''}`}});
const dest=(n)=>{const k=(n.kind||n.type||'').toLowerCase();if(k.includes('interview'))return '/hr/interviews';if(k.includes('eval'))return '/hr/evaluations';if(k.includes('offer'))return '/hr/offers';if(k.includes('place'))return '/hr/placements';if(k.includes('compan'))return '/hr/companies';if(k.includes('job'))return '/hr/jobs';return n.link||n.actionUrl||'/hr/dashboard';};
export default function HRNotifications(){
const nav=useNavigate();
const [f,setF]=useState('all');const [items,setItems]=useState([]);const [unread,setUnread]=useState(0);
const [st,setSt]=useState('loading');const [err,setErr]=useState('');
const load=useCallback(async()=>{setSt('loading');try{const {data}=await axios.get(`${API}/api/notifications`,{...hdr(),params:{limit:50}});setItems(data.notifications||[]);setUnread(data.unreadCount||0);setSt('ok');}catch(e){setErr(e.response?.data?.message||'Unable to load.');setSt('err');}},[]);
useEffect(()=>{load();},[load]);
const open=async(n)=>{try{if(!n.read)await axios.put(`${API}/api/notifications/${n._id}/read`,{},hdr());}catch{}nav(dest(n));};
const all=async()=>{await axios.put(`${API}/api/notifications/read-all`,{},hdr());load();};
const list=items.filter((n)=>f==='all'?true:f==='unread'?!n.read:(n.kind||'').toLowerCase().includes('interview')||(n.kind||'').toLowerCase().includes('offer')||(n.kind||'').toLowerCase().includes('place'));
return(<div style={page}>
<div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:14}}><div><h2 style={h2}>Notifications</h2><p style={sub}>{unread} unread · HR events and actions</p></div><button type="button" style={btnG} onClick={all}>Mark all read</button></div>
<div style={{display:'flex',gap:8,marginBottom:12}}>{[['all','All'],['unread','Unread'],['important','Important']].map((t)=>(<button key={t[0]} type="button" onClick={()=>setF(t[0])} style={{...btnG,background:f===t[0]?'#3f7da0':'#fff',color:f===t[0]?'#fff':'#0F172A'}}>{t[1]}</button>))}</div>
{st==='loading'&&<Loading/>}{st==='err'&&<Err text={err} onRetry={load}/>}
{st==='ok'&&(list.length===0?<Empty text="No notifications."/>:<div style={{...card,padding:0,overflow:'hidden'}}>{list.map((n)=>(<button key={n._id} type="button" onClick={()=>open(n)} style={{display:'flex',gap:12,width:'100%',textAlign:'left',padding:'14px 16px',border:'none',borderBottom:'1px solid #F1F5F9',background:n.read?'#fff':'#F0F9FF',cursor:'pointer'}}><span style={{width:10,height:10,borderRadius:99,background:n.read?'#CBD5E1':'#3f7da0',marginTop:5,flexShrink:0}}/><span><b style={{fontSize:13}}>{n.title}</b><div style={{fontSize:12,color:'#64748B'}}>{n.message}</div><div style={{fontSize:11,color:'#94A3B8'}}>{new Date(n.createdAt).toLocaleString('en-IN')}</div></span></button>))}</div>)}
</div>);}
