import fs from 'node:fs';
import path from 'node:path';

// This is a local configuration preflight, not authentication or runtime QA.
export function inspectNativeBinding(hostRoot) {
  const pkg=JSON.parse(fs.readFileSync(path.join(hostRoot,'package.json'),'utf8'));
  const deps={...pkg.dependencies,...pkg.devDependencies};
  if(!deps['taro-plugin-qd']&&!deps['qdmp-devtools'])return {required:false};
  const file=path.join(hostRoot,'qdmp.json');
  const pending=reason=>({required:true,ready:false,file,reason});
  if(!fs.existsSync(file))return pending('Missing local qdmp.json; clean Git exports omit this ignored application binding.');
  if(fs.lstatSync(file).isSymbolicLink())return pending('Binding must be a local file in the isolated host, not a symlink.');
  let config;try{config=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return pending('Invalid qdmp.json.');}
  if(typeof config.appId!=='string'||!/^echo[A-Za-z0-9]+$/.test(config.appId))return pending('Missing or placeholder QD application ID.');
  return {required:true,ready:true,file,appId:config.appId,runtimeVerified:false};
}
