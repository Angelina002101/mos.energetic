import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/contact.js';
test('Серверная обработка заявок', async(t)=>{
 const originalFetch=globalThis.fetch, originalNow=Date.now;
 const oldToken=process.env.TELEGRAM_BOT_TOKEN,oldChat=process.env.TELEGRAM_CHAT_ID;
 process.env.TELEGRAM_BOT_TOKEN='test-secret';process.env.TELEGRAM_CHAT_ID='test-chat';
 let now=originalNow(),sent=0;Date.now=()=>now;
 const call=async(method,body,headers={})=>{
  const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(data){this.data=data;return this}};
  await handler({method,body,headers:{host:'example.test',origin:'https://example.test','content-type':'application/json',...headers}},res);return res;
 };
 try{
 globalThis.fetch=async(url,options)=>{
  sent++;assert.equal(url,'https://api.telegram.org/bottest-secret/sendMessage');
  const b=JSON.parse(options.body);assert.equal(b.chat_id,'test-chat');assert.match(b.text,/Новая заявка/);assert.equal(b.parse_mode,undefined);
  return {ok:true,json:async()=>({ok:true})};
 };
 const c=await call('GET');assert.equal(c.code,200);assert.equal(c.headers['Cache-Control'],'no-store');
 const q=JSON.parse(Buffer.from(c.data.challenge.split('.')[0],'base64url').toString());
 const payload={name:'Тест',phone:'+79990000001',service:'Технологическое присоединение',consent:true,challenge:c.data.challenge,answer:String(q.a+q.b)};
 await t.test('Слишком быстро',async()=>assert.equal((await call('POST',payload)).code,400));
 now+=2000;
 for(const [title,patch,code] of [
 ['Неверный ответ',{answer:'99'},400],['Подпись',{challenge:c.data.challenge+'a'},400],
 ['Нет согласия',{consent:false},400],['Короткий телефон',{phone:'123'},400],['Нет имени',{name:''},400],
 ['Неизвестная услуга',{service:'unknown'},400],['Ловушка',{website:'spam'},400],['Размер',{message:'x'.repeat(9000)},413]
 ])await t.test(title,async()=>assert.equal((await call('POST',{...payload,...patch})).code,code));
 await t.test('Чужой Origin',async()=>assert.equal((await call('POST',payload,{origin:'https://evil.test'})).code,403));
 await t.test('Нет Origin',async()=>assert.equal((await call('POST',payload,{origin:undefined})).code,403));
 await t.test('Неверный JSON',async()=>assert.equal((await call('POST','{')).code,400));
 await t.test('Content-Type',async()=>assert.equal((await call('POST',payload,{'content-type':'text/plain'})).code,415));
 await t.test('Метод DELETE',async()=>assert.equal((await call('DELETE')).code,405));
 assert.equal(sent,0);
 await t.test('Успешная доставка',async()=>{assert.equal((await call('POST',payload)).data.ok,true);assert.equal(sent,1)});
 await t.test('Повтор',async()=>assert.equal((await call('POST',payload)).code,429));
 await t.test('Отказ Telegram',async()=>{globalThis.fetch=async()=>({ok:false,json:async()=>({ok:false})});assert.equal((await call('POST',{...payload,phone:'+79990000002'})).code,502)});
 await t.test('Сетевой сбой',async()=>{globalThis.fetch=async()=>{throw Error('network')};assert.equal((await call('POST',{...payload,phone:'+79990000003'})).code,502)});
 await t.test('Истекшая проверка',async()=>{now+=700000;assert.equal((await call('POST',{...payload,phone:'+79990000004'})).code,400)});
 await t.test('Нет настроек бота',async()=>{delete process.env.TELEGRAM_BOT_TOKEN;assert.equal((await call('GET')).code,503)});
 }finally{
 globalThis.fetch=originalFetch;Date.now=originalNow;
 if(oldToken===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=oldToken;
 if(oldChat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=oldChat;
 }
});
