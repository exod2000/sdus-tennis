import React, {useEffect, useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import './admin.css';

const supabaseUrl=import.meta.env.VITE_SUPABASE_URL;
const supabaseKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase=supabaseUrl&&supabaseKey?createClient(supabaseUrl,supabaseKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
}):null;
const names={super_admin:'Super-administrateur',admin:'Administrateur',editor:'Éditeur'};
const callbackPath='/admin/auth/callback';
const sections=[['overview','Vue d’ensemble'],['news','Actualités'],['camps','Stages jeunes'],['prices','Tarifs et inscriptions'],['teachers','Enseignants'],['committee','Équipe dirigeante'],['admins','Administrateurs']];
const contentTables={news:'club_news',camps:'club_camps',prices:'club_prices',teachers:'club_teachers',committee:'club_committee'};

export default function AdminApp(){
 const [session,setSession]=useState(null);
 const [loading,setLoading]=useState(true);
 const [role,setRole]=useState(null);
 const [checkingRole,setCheckingRole]=useState(false);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [recovery,setRecovery]=useState(false);
 const [passwordFlow,setPasswordFlow]=useState(false);
 const [path,setPath]=useState(location.pathname);
 const [section,setSection]=useState('overview');
 const go=(url)=>{history.replaceState({},'',url);setPath(url)};

 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  let alive=true;
  const params=new URLSearchParams(location.search);
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const type=params.get('type')||hash.get('type');
  const isCallback=location.pathname===callbackPath;
  if(type==='recovery'||type==='invite'||location.pathname==='/admin/reset-password')setPasswordFlow(true);
  if(params.get('error_description')||hash.get('error_description')){
   setMessage('Ce lien a expiré ou est invalide. Demande un nouveau lien depuis « Mot de passe oublié » sur la page de connexion.');
  }
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
   if(!alive)return;
   setSession(next);
   if(event==='PASSWORD_RECOVERY')setPasswordFlow(true);
  });
  (async()=>{
   try{
    // Supporte les liens Supabase contenant un code PKCE.
    if(isCallback&&params.has('code')){
     const {error}=await supabase.auth.exchangeCodeForSession(params.get('code'));
     if(error)throw error;
     setPasswordFlow(true);
    }
    const {data,error}=await supabase.auth.getSession();
    if(error)throw error;
    if(alive)setSession(data.session);
   }catch(e){if(alive)setMessage('Lien de connexion invalide ou expiré. Demande un nouveau lien depuis la page de connexion.');}
   finally{if(alive)setLoading(false)}
  })();
  return()=>{alive=false;subscription.unsubscribe()};
 },[]);

 useEffect(()=>{
  if(!supabase||!session?.user?.id){setRole(null);setCheckingRole(false);return;}
  let alive=true;setCheckingRole(true);
  supabase.rpc('get_my_admin_role').then(({data,error})=>{
   if(!alive)return;
   setRole(!error&&Object.hasOwn(names,data)?data:null);
   if(error)setMessage('Impossible de vérifier ton rôle administrateur.');
   setCheckingRole(false);
  });
  return()=>{alive=false};
 },[session?.user?.id]);

 async function login(e){e.preventDefault();setBusy(true);setMessage('');
  const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
  setBusy(false);setPassword('');
  if(error)setMessage('Connexion impossible. Vérifie ton adresse, ton mot de passe et la confirmation de ton compte.');
  else go('/admin');
 }
 async function sendRecovery(e){e.preventDefault();setBusy(true);setMessage('');
  const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+callbackPath});
  setBusy(false);
  setMessage(error?'Envoi impossible pour le moment. Réessaie plus tard.':'Si cette adresse possède un compte, un e-mail de récupération a été envoyé.');
 }
 async function savePassword(e){e.preventDefault();setMessage('');
  if(password.length<12){setMessage('Choisis au moins 12 caractères.');return;}
  if(!/[a-zA-Z]/.test(password)||!/[0-9]/.test(password)){setMessage('Le mot de passe doit contenir des lettres et des chiffres.');return;}
  if(password!==confirmPassword){setMessage('Les deux mots de passe sont différents.');return;}
  setBusy(true);
  const {error}=await supabase.auth.updateUser({password});
  setBusy(false);setPassword('');setConfirmPassword('');
  if(error){setMessage('Impossible de modifier le mot de passe. Demande un nouveau lien si nécessaire.');return;}
  setPasswordFlow(false);setMessage('Mot de passe enregistré. Ton compte est prêt.');go('/admin');
 }
 async function logout(){await supabase.auth.signOut();setRole(null);setPasswordFlow(false);go('/admin/login')}
 const callback=path===callbackPath;
 return <div className="admin-layout"><header className="admin-header"><a href="/" className="admin-brand"><img src="/icone-sdus.svg" alt=""/> SDUS <strong>TENNIS</strong></a><a href="/">← Retour au site</a></header><main className="admin-main"><div className="admin-panel"><span className="admin-eyebrow">ESPACE PRIVÉ · BUREAU DU CLUB</span><h1>Administration</h1>
 {!supabase?<div className="admin-notice">Configuration Supabase manquante. Vérifie les variables Cloudflare et relance un déploiement.</div>:
 loading?<p>Vérification de la connexion…</p>:
 passwordFlow&&session?<form onSubmit={savePassword}><h2>Créer ton mot de passe</h2><p>Choisis au moins 12 caractères, avec des lettres et des chiffres.</p><label htmlFor="admin-pass">Nouveau mot de passe</label><input id="admin-pass" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/><label htmlFor="admin-confirm">Confirmer le mot de passe</label><input id="admin-confirm" type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/><button disabled={busy}>Enregistrer mon mot de passe</button></form>:
 !session?<>{(recovery||path==='/admin/reset-password')?<form onSubmit={sendRecovery}><h2>Créer ou récupérer un mot de passe</h2><label htmlFor="admin-email">Adresse e-mail</label><input id="admin-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><button disabled={busy}>Recevoir un lien</button><button type="button" className="admin-link" onClick={()=>{setRecovery(false);go('/admin/login')}}>Retour à la connexion</button></form>:<form onSubmit={login}><h2>Connexion sécurisée</h2><p>Réservé aux membres du bureau invités.</p><label htmlFor="admin-email">Adresse e-mail</label><input id="admin-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/><label htmlFor="admin-pass">Mot de passe</label><input id="admin-pass" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/><button disabled={busy}>Se connecter</button><button type="button" className="admin-link" onClick={()=>{setRecovery(true);go('/admin/reset-password')}}>Mot de passe oublié ?</button></form>}</>:
 checkingRole?<p>Vérification des droits…</p>:
 role?<Dashboard role={role} email={session.user.email} section={section} setSection={setSection} logout={logout}/>:
 <div><div className="admin-notice">Compte connecté, mais aucun rôle administrateur autorisé n'a été trouvé.</div><p>{session.user.email}</p><button onClick={logout}>Se déconnecter</button></div>}
 {callback&&!session&&!loading&&<p>Si le lien ne fonctionne pas, demande un nouveau lien depuis « Mot de passe oublié ».</p>}
 {message&&<p className="admin-message" role="status">{message}</p>}
 </div></main><footer className="admin-footer">SDUS Tennis · Espace réservé aux personnes autorisées</footer></div>;
}

function Dashboard({role,email,section,setSection,logout}){
 const [rows,setRows]=useState([]),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState({title:'',body:'',date:'',end_date:'',link:'',image_url:'',age_range:'',schedule:'',price:'',status:'open',published:false}),[users,setUsers]=useState([]),[newsImage,setNewsImage]=useState(null),[campImage,setCampImage]=useState(null);
 const table=contentTables[section];
 async function load(){setStatus('');setEditing(null);if(section==='admins'){
  const {data,error}=await supabase.rpc('list_club_admins');setUsers(data||[]);if(error)setStatus('Pour afficher les administrateurs, exécute d’abord le script SQL fourni.');return;
 }
 if(!table){setRows([]);return;}const {data,error}=await supabase.from(table).select('*').order('created_at',{ascending:false});setRows(data||[]);if(error)setStatus('Table non disponible. Exécute d’abord le script SQL fourni dans Supabase.');}
 useEffect(()=>{load()},[section]);
 function startNew(){setEditing('new');setNewsImage(null);setCampImage(null);setForm({title:'',body:'',date:'',end_date:'',link:'',image_url:'',age_range:'',schedule:'',price:'',status:'open',published:false});}
 function edit(r){setEditing(r.id);setNewsImage(null);setCampImage(null);setForm({title:r.title||'',body:r.body||'',date:r.date||'',end_date:r.end_date||'',link:r.link||'',image_url:r.image_url||'',age_range:r.age_range||'',schedule:r.schedule||'',price:r.price||'',status:r.status||'open',published:!!r.published});}
 async function save(e){e.preventDefault();if(section==='camps'&&(!form.date||!form.end_date||form.end_date<form.date)){setStatus('Indique une date de début et une date de fin valide.');return;}setBusy(true);setStatus('');const record={title:form.title.trim(),body:form.body.trim(),date:form.date||null,link:form.link.trim()||null,published:form.published};if(section==='camps'){
  record.end_date=form.end_date||null;record.image_url=form.image_url||null;
  record.age_range=form.age_range.trim()||null;record.schedule=form.schedule.trim()||null;record.price=form.price.trim()||null;record.status=form.status;
  if(campImage){
   if(!['image/jpeg','image/png','image/webp'].includes(campImage.type)||campImage.size>5*1024*1024){setBusy(false);setStatus('Image JPG, PNG ou WebP de 5 Mo maximum.');return;}
   const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[campImage.type];
   const path='camps/'+crypto.randomUUID()+'.'+ext;
   const {error:uploadError}=await supabase.storage.from('club-camp-images').upload(path,campImage,{contentType:campImage.type,upsert:false});
   if(uploadError){setBusy(false);setStatus('Impossible d’envoyer la photo du stage. Vérifie le script SQL Supabase.');return;}
   record.image_url=supabase.storage.from('club-camp-images').getPublicUrl(path).data.publicUrl;
  }
 }if(section==='news'){
  record.image_url=form.image_url||null;
  if(newsImage){
   if(!['image/jpeg','image/png','image/webp'].includes(newsImage.type)||newsImage.size>5*1024*1024){setBusy(false);setStatus('Choisis une image JPG, PNG ou WebP de 5 Mo maximum.');return;}
   const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[newsImage.type];
   const path='news/'+crypto.randomUUID()+'.'+ext;
   const {error:uploadError}=await supabase.storage.from('club-news-images').upload(path,newsImage,{contentType:newsImage.type,upsert:false});
   if(uploadError){setBusy(false);setStatus('Envoi de l’image impossible. Vérifie le script SQL de stockage Supabase.');return;}
   record.image_url=supabase.storage.from('club-news-images').getPublicUrl(path).data.publicUrl;
  }
 }
 const result=editing==='new'?await supabase.from(table).insert(record):await supabase.from(table).update(record).eq('id',editing);setBusy(false);if(result.error){setStatus('Enregistrement refusé : vérifie les droits ou le script SQL.');return;}setEditing(null);await load();setStatus('Enregistré avec succès.');}
 async function remove(r){if(!confirm('Supprimer définitivement « '+r.title+' » ?'))return;setBusy(true);const {error}=await supabase.from(table).delete().eq('id',r.id);setBusy(false);await load();setStatus(error?'Suppression refusée.':'Élément supprimé.');}
 return <div className="dash"><aside className="dash-sidebar"><div className="dash-account"><b>SDUS Tennis</b><small>{names[role]}</small></div><nav aria-label="Menu administration">{sections.filter(([id])=>id!=='admins'||role==='super_admin').map(([id,label])=><button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}>{label}</button>)}</nav><button className="dash-logout" onClick={logout}>Se déconnecter</button></aside><section className="dash-content"><div className="dash-top"><div><span className="admin-eyebrow">ESPACE PRIVÉ · BUREAU DU CLUB</span><h1>{sections.find(([id])=>id===section)?.[1]}</h1><p>Connecté : {email}</p></div>{table&&!editing&&<button onClick={startNew}>+ Ajouter</button>}</div><div className="admin-notice admin-ok">Session vérifiée · {names[role]}</div>
 {section==='overview'&&<><div className="dash-cards">{sections.filter(([id])=>id!=='overview'&&(id!=='admins'||role==='super_admin')).map(([id,label])=><button key={id} onClick={()=>setSection(id)}><strong>{label}</strong><span>Ouvrir la rubrique →</span></button>)}</div><div className="dash-help"><h2>Bienvenue dans le bureau du club</h2><p>Utilise le menu pour préparer et enregistrer les informations du SDUS Tennis. Les données sont conservées dans Supabase, avec des droits contrôlés côté base de données.</p><p><strong>Important :</strong> les nouvelles fiches sont stockées dans l'administration. Leur affichage automatique sur les pages publiques du site nécessitera de relier ces pages aux données Supabase.</p></div></>}
 {table&&<>{editing!==null?<form className="dash-form" onSubmit={save}><h2>{editing==='new'?'Nouvelle fiche':'Modifier la fiche'}</h2><label>Titre<input required maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Description<textarea rows="7" value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label><label>{section==='camps'?'Date de début':'Date (facultative)'}<input type="date" required={section==='camps'} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>{section==='camps'&&<><label>Date de fin<input type="date" required min={form.date||undefined} value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></label><label>Photo du stage (JPG, PNG, WebP, 5 Mo maximum)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setCampImage(e.target.files?.[0]||null)}/></label>{campImage?<p>Nouvelle photo : {campImage.name}</p>:form.image_url?<img src={form.image_url} alt="Photo actuelle du stage" style={{width:260,maxWidth:'100%',borderRadius:12}}/>:null}{form.image_url&&<button type="button" className="secondary" onClick={()=>{setForm({...form,image_url:''});setCampImage(null)}}>Retirer la photo</button>}
<label>Âge / public (facultatif)<input placeholder="Ex. 6 à 17 ans" value={form.age_range} maxLength={100} onChange={e=>setForm({...form,age_range:e.target.value})}/></label>
<label>Horaires (facultatif)<input placeholder="Ex. 9h30 à 16h" value={form.schedule} maxLength={100} onChange={e=>setForm({...form,schedule:e.target.value})}/></label>
<label>Tarif indicatif (facultatif)<input placeholder="Ex. À partir de 60 €" value={form.price} maxLength={100} onChange={e=>setForm({...form,price:e.target.value})}/></label>
<label>État des inscriptions<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="open">Inscriptions ouvertes</option><option value="soon">Bientôt disponible</option><option value="closed">Inscriptions closes</option></select></label>
<p className="admin-notice">Le bouton « Demander une inscription » utilise automatiquement le formulaire du club. Les stages existants restent conservés.</p></>}{section==='news'&&<div className="news-image-field"><label>Image de l’actualité (JPG, PNG ou WebP, 5 Mo max.)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setNewsImage(e.target.files?.[0]||null)}/></label>{newsImage?<p>Nouvelle image : {newsImage.name}</p>:form.image_url?<img src={form.image_url} alt="Image actuelle de l’actualité"/>:null}{form.image_url&&<button type="button" className="secondary" onClick={()=>{setForm({...form,image_url:''});setNewsImage(null)}}>Retirer l’image actuelle</button>}</div>}<label>Lien (facultatif)<input type="url" placeholder="https://..." value={form.link} onChange={e=>setForm({...form,link:e.target.value})}/></label><label className="dash-check"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/> Marquer comme publié</label><div className="dash-actions"><button disabled={busy}>Enregistrer</button><button type="button" className="secondary" onClick={()=>setEditing(null)}>Annuler</button></div></form>:<div className="dash-list">{rows.length===0?<p>Aucune fiche enregistrée dans cette rubrique.</p>:rows.map(r=><article key={r.id}><div><strong>{r.title}</strong><p>{(r.body||'').slice(0,150)}</p><small>{r.published?'Publié':'Brouillon'} {r.date?'· '+r.date:''}</small></div><div className="dash-actions"><button onClick={()=>edit(r)}>Modifier</button><button className="danger" disabled={busy} onClick={()=>remove(r)}>Supprimer</button></div></article>)}</div>}</>}
 {section==='admins'&&<div className="dash-help"><h2>Comptes administrateurs</h2><p>Les invitations Supabase doivent être envoyées par une fonction serveur sécurisée ou depuis le tableau de bord Supabase. Ne place jamais la clé secrète Supabase dans le navigateur.</p><p>Pour ajouter un super-administrateur, invite d’abord la personne dans Supabase Authentication, puis attribue-lui le rôle dans la table <code>admin_users</code> avec une requête SQL autorisée.</p>{users.length>0&&<div className="dash-list">{users.map(u=><article key={u.user_id}><span>{u.email||u.user_id}</span><strong>{names[u.role]||u.role}</strong></article>)}</div>}</div>}
 {status&&<p className="admin-message" role="status">{status}</p>}</section></div>
}
