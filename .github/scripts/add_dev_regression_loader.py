from pathlib import Path
import re

p=Path('mobile/StuffApp.js')
t=p.read_text()

marker="import { useStuffAuth } from './AuthContext';\n"
if marker not in t:
    raise SystemExit('auth import marker missing')
if "regression-shop-v1.json" not in t:
    t=t.replace(marker, marker+"import regressionShop from './test-fixtures/regression-shop-v1.json';\n",1)

marker="  function reportProblem(){\n"
if marker not in t:
    raise SystemExit('reportProblem marker missing')
loader=r'''  function loadRegressionShop(){
    const rows=(regressionShop?.expected_list||[]).map((x,idx)=>({
      id:`regression-${idx+1}`,
      name:String(x.name||'').trim(),
      quantity:Number(x.quantity)||1,
      unit:String(x.unit||'').trim(),
    })).filter(x=>x.name);
    Alert.alert('Load regression shop?',`Replace the current list with ${rows.length} test items? This is available only in development builds.`,[
      {text:'Cancel',style:'cancel'},
      {text:'Load test shop',onPress:()=>{setItems(rows);setOpen(true);setTab('home');setMoreView('main');setStatus('Regression shop loaded.')}}
    ]);
  }

'''
if "function loadRegressionShop" not in t:
    t=t.replace(marker,loader+marker,1)

pattern=re.compile(r'(\s*<MenuRow title="How it works"[^\n]*\n)')
m=pattern.search(t)
if not m:
    raise SystemExit('How it works menu row missing')
row=m.group(1)
if 'Load regression test shop' not in t:
    addition=row+"        {__DEV__&&<MenuRow title=\"Load regression test shop\" sub=\"22 deliberately awkward groceries for Woolworths + Coles testing\" right=\"Load\" onPress={loadRegressionShop} />}\n"
    t=t[:m.start()]+addition+t[m.end():]

p.write_text(t)
