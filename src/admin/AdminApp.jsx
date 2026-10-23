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
 role?<div><div className="admin-notice admin-ok">Session vérifiée · {names[role]}</div><h2>Bienvenue dans l'administration</h2><p>Connecté : <strong>{session.user.email}</strong></p><p>La connexion est prête. La gestion des contenus et les invitations depuis le tableau de bord seront ajoutées dans une prochaine étape, après sécurisation des opérations côté serveur.</p><button onClick={logout}>Se déconnecter</button></div>:
 <div><div className="admin-notice">Compte connecté, mais aucun rôle administrateur autorisé n'a été trouvé.</div><p>{session.user.email}</p><button onClick={logout}>Se déconnecter</button></div>}
 {callback&&!session&&!loading&&<p>Si le lien ne fonctionne pas, demande un nouveau lien depuis « Mot de passe oublié ».</p>}
 {message&&<p className="admin-message" role="status">{message}</p>}
 </div></main><footer className="admin-footer">SDUS Tennis · Espace réservé aux personnes autorisées</footer></div>;
}
