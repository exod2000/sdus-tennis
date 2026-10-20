// Cloudflare Pages Function — the token stays in Cloudflare's secret environment.
const CACHE_SECONDS = 6 * 60 * 60;
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'content-type':'application/json; charset=utf-8','cache-control':status===200?`public, max-age=300, s-maxage=${CACHE_SECONDS}`:'no-store','x-content-type-options':'nosniff'}});

export async function onRequestGet({request, env}) {
  if (!env.INSTAGRAM_ACCESS_TOKEN) return json({posts:[], error:'Instagram non configuré'},503);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(new URL('/api/instagram',request.url).toString(),{method:'GET'});
  if(cache){const hit=await cache.match(key);if(hit)return hit;}
  try {
    const url = new URL('https://graph.instagram.com/me/media');
    url.searchParams.set('fields','id,caption,media_type,media_url,thumbnail_url,permalink,timestamp');
    url.searchParams.set('limit','12');
    const upstream = await fetch(url.toString(),{headers:{Authorization:`Bearer ${env.INSTAGRAM_ACCESS_TOKEN}`}});
    if(!upstream.ok) throw new Error(`Instagram API HTTP ${upstream.status}`);
    const body=await upstream.json();
    if(!Array.isArray(body.data))throw new Error('Instagram API response missing data');
    const posts=body.data.map(item=>({
      id:String(item.id||''),
      caption:String(item.caption||'').slice(0,180),
      image:item.media_type==='VIDEO'?(item.thumbnail_url||item.media_url):item.media_url,
      permalink:item.permalink,
      timestamp:item.timestamp,
      isVideo:item.media_type==='VIDEO'
    })).filter(item=>item.id&&item.image&&/^https:\/\//.test(item.image)&&item.permalink&&/^https:\/\/(www\.)?instagram\.com\//.test(item.permalink)).slice(0,3);
    const response=json({posts});
    if(cache) await cache.put(key,response.clone());
    return response;
  }catch(err){console.error('Instagram feed failed:',err.message);return json({posts:[],error:'Publications temporairement indisponibles'},503);}
}
