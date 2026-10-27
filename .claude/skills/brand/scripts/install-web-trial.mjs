import fs from 'node:fs';import path from 'node:path';import {installLocalStylePack} from './install-local-style-pack.mjs';
export function installWebTrial({modFile,destinationRoot,brand}){
 if(!/^[a-z0-9][a-z0-9-]*$/.test(brand||''))throw Error('WEB_TRIAL_BRAND_INVALID');
 const realFuture=p=>{let at=path.resolve(p),tail=[];while(!fs.existsSync(at)){tail.unshift(path.basename(at));at=path.dirname(at);}return path.join(fs.realpathSync(at),...tail);};
 const destination=realFuture(destinationRoot),source=fs.realpathSync(path.dirname(modFile));
 const contains=(a,b)=>{const r=path.relative(a,b);return r===''||(!r.startsWith('..')&&!path.isAbsolute(r));};
 if(contains(source,destination)||contains(destination,source))throw Error('WEB_TRIAL_ISOLATION_REQUIRED');
 for(let dir=source;;dir=path.dirname(dir)){if(fs.existsSync(path.join(dir,'.git'))){if(contains(dir,destination))throw Error('WEB_TRIAL_PRODUCER_REPOSITORY_FORBIDDEN');break;}if(path.dirname(dir)===dir)break;}
 if(fs.existsSync(destination)&&fs.lstatSync(destination).isSymbolicLink())throw Error('WEB_TRIAL_SYMLINK_DESTINATION');
 const mod=JSON.parse(fs.readFileSync(modFile,'utf8'));
 if(mod.manifest?.scope?.kind!=='source-scoped-style-trial')throw Error('WEB_TRIAL_SCOPE_REQUIRED');
 const kits=mod.componentKits||[];
 if(!kits.length||kits.some(k=>k.runtime!=='browser-dom'||k.framework!=='vue3'))throw Error('WEB_TRIAL_REQUIRES_BROWSER_VUE_KIT');
 fs.mkdirSync(destinationRoot,{recursive:true});
 const installed=installLocalStylePack({modFile,destinationRoot,destinationMigration:path.join(destinationRoot,'migrations',brand),brand});
 return {...installed,command:'install-web-trial',scope:'isolated-component-web-consumption',entryPoints:kits.map(k=>({id:k.id,entry:k.entry,stylesheet:k.stylesheet,peerDependencies:k.peerDependencies})),hostApproved:false,productionApproved:false,userGoalCompleted:false};
}
