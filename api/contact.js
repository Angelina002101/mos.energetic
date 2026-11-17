import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
// This per-instance throttle is supplemental, not a distributed rate limiter.
const recent = new Map();
const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('hex');
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const secret = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Метод не поддерживается.'}); }
  if (!secret || !chatId) return res.status(503).json({error:'Форма ещё не настроена. Свяжитесь с нами по телефону или email.'});
  if(req.method === 'GET') {
    const a=randomInt(2,10), b=randomInt(1,10), issued=Date.now();
    const data=Buffer.from(JSON.stringify({a,b,issued,nonce:randomInt(1,2147483647)})).toString('base64url');
    return res.status(200).json({question:`Сколько будет ${a} + ${b}?`,challenge:`${data}.${sign(data,secret)}`});
  }
  const origin=req.headers.origin;
  const host=req.headers.host;
  if(!origin) return res.status(403).json({error:'Откройте форму на сайте.'});
  try {if(new URL(origin).host !== host) return res.status(403).json({error:'Запрос отклонён.'});} catch {return res.status(403).json({error:'Запрос отклонён.'});}
  if(!String(req.headers['content-type']||'').includes('application/json')) return res.status(415).json({error:'Неверный формат запроса.'});
  let body=req.body;
  try {if(typeof body==='string') body=JSON.parse(body);} catch {return res.status(400).json({error:'Некорректные данные.'});}
  if(!body || typeof body!=='object' || Array.isArray(body)) return res.status(400).json({error:'Некорректные данные.'});
  if(Buffer.byteLength(JSON.stringify(body))>8192) return res.status(413).json({error:'Слишком длинная заявка.'});
  if(body.website) return res.status(400).json({error:'Запрос отклонён.'});
  const clean=(key,max)=> typeof body[key]==='string'?body[key].trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
  const name=clean('name',80), phone=clean('phone',30), service=clean('service',80), amount=clean('amount',80), message=clean('message',1500);
  if(name.length<2 || phone.replace(/\D/g,'').length<10 || phone.replace(/\D/g,'').length>15 || body.consent!==true || !['Технологическое присоединение','Электромонтаж','Другое'].includes(service)) return res.status(400).json({error:'Проверьте имя, телефон, услугу и согласие на обработку данных.'});
  try {
    const [data,signature,...extra]=String(body.challenge||'').split('.');
    const expected=sign(data||'',secret);
    if(extra.length || !signature || signature.length!==expected.length || !timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) throw Error();
    const {a,b,issued}=JSON.parse(Buffer.from(data,'base64url').toString());
    if(!Number.isFinite(issued) || Date.now()-issued>600000 || Date.now()-issued<1200 || !/^\d{1,3}$/.test(String(body.answer)) || Number(body.answer)!==a+b) throw Error();
  } catch {return res.status(400).json({error:'Проверка от спама не пройдена или устарела. Обновите пример и попробуйте снова.'});}
  const now=Date.now();
  for(const [key,time] of recent) if(now-time>60000) recent.delete(key);
  const key=sign(phone.replace(/\D/g,''),secret);
  if(recent.has(key)) return res.status(429).json({error:'Заявка уже обрабатывается. Попробуйте через минуту.'});
  recent.set(key,now);
  const text=['⚡ Новая заявка — Энергетика',`Услуга: ${service}`,`Имя: ${name}`,`Телефон: ${phone}`,`Выставленная стоимость: ${amount||'не указана'}`,`Ситуация: ${message||'не описана'}`,'Согласие на обработку данных: дано',`Дата: ${new Date().toISOString()}`].join('\n');
  try {
    const response=await fetch(`https://api.telegram.org/bot${secret}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(10000)});
    const result=await response.json();
    if(!response.ok || result.ok!==true) {recent.delete(key);return res.status(502).json({error:'Не удалось доставить заявку. Позвоните нам или напишите на email.'});}
    return res.status(200).json({ok:true});
  } catch {return res.status(502).json({error:'Доставка не подтверждена. Свяжитесь с нами по телефону или email.'});}
}
