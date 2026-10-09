#!/usr/bin/env node
import {prepareQaReview} from './qa-review-contract.mjs';
const args=process.argv.slice(2), opt=name=>args[args.indexOf(name)+1];
try {
  const result=prepareQaReview({root:args.includes('--root')?opt('--root'):process.cwd(), brand:opt('--brand'), reviewMode:opt('--review-mode'), qaExecutionId:opt('--qa-execution-id'), priorReceipt:args.includes('--prior-receipt')?opt('--prior-receipt'):null, affected:args.includes('--affected')?opt('--affected').split(',').filter(Boolean):[], regressionScope:args.includes('--regression-scope')?opt('--regression-scope').split(',').filter(Boolean):[], capacityErrorFile:args.includes('--capacity-error-file')?opt('--capacity-error-file'):null,replacePrepared:args.includes('--replace-prepared')});
  console.log(JSON.stringify({ok:true,...result},null,2));
} catch(error) {console.error(error.message);process.exitCode=2;}
