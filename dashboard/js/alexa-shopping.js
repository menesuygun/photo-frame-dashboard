// The voice endpoint verifies Amazon signatures and restricts writes to one skill and account.
(function(){
 const A=window.App;
 A.alexaShoppingSheet=function(){
  A.sheet('<div class="sheet-pad alexa-shopping-settings"><div class="label">Voice shopping</div><h2 class="serif sheet-h">Alexa shopping</h2><p class="sheet-p">Add groceries by asking Family Frame. Items go straight to your shared list, even when the dashboard is closed.</p><p class="sheet-p"><b>“Alexa, ask Family Frame to add milk.”</b><br><b>“Alexa, ask Family Frame to add two eggs to Costco.”</b><br><b>“Alexa, ask Family Frame to add screws to Other.”</b></p><p class="sheet-p">Grocery Store is the default. Add one item at a time. Matching items in the same store increase their quantity; completed items return to the list.</p><p class="sheet-p" role="status" data-alexa-status>Checking setup…</p><div class="sheet-actions"><a class="btn btn--ghost" href="/alexa/family-frame-en-CA.json" download="family-frame-en-CA.json">Download voice model</a><button class="btn btn--ghost" data-alexa-refresh>Refresh status</button></div><p class="sheet-p">One-time setup is in the Amazon Developer Console. This uses a separate Family Frame skill; it does not read Alexa’s built-in shopping list.</p></div>',{onMount(sheet){
   async function refresh(){const status=sheet.querySelector('[data-alexa-status]');status.textContent='Checking setup…';try{
    const response=await fetch('/api/alexa-shopping',{cache:'no-store',headers:{Authorization:'Bearer '+(localStorage.getItem('frame-calendar-code')||'')},signal:AbortSignal.timeout(15000)}),data=await response.json();
    if(!response.ok)throw Error(data.error||'Could not check setup.');
    const missing=[];if(!data.skillConfigured)missing.push('Alexa skill');if(!data.accountConfigured)missing.push('Amazon account');if(!data.storageConfigured)missing.push('Family sync');
    status.textContent=missing.length?'Setup still needed: '+missing.join(', ')+'.':'Dashboard connection ready. Enable Development testing for your skill in the Alexa Developer Console, then use your Echo.';
   }catch(error){status.textContent=error.message;}}
   sheet.querySelector('[data-alexa-refresh]').onclick=refresh;refresh();
  }});
 };
})();
