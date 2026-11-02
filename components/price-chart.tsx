// Dependency-free recreation of the original stepped lowest-price chart.
import type { Row } from "../lib/db";
import { money, time } from "../lib/format";
export function PriceChart({points,target,currency}:{points:Row[];target:unknown;currency:string}) {
  const values=points.map(p=>Number(p.unit_price)).filter(Number.isFinite);
  if(!values.length) return <div className="empty">No lowest-price history yet.</div>;
  const targetN=target==null?null:Number(target);
  const bounded=targetN==null?values:[...values,targetN];
  const min=Math.min(...bounded),max=Math.max(...bounded);
  const lower=min===max?min-1:min-(max-min)*.12;
  const upper=min===max?max+1:max+(max-min)*.12;
  const x=(i:number)=>75+i*790/Math.max(values.length-1,1);
  const y=(v:number)=>235-(v-lower)/(upper-lower)*205;
  let line=`M ${x(0)} ${y(values[0])}`;
  for(let i=1;i<values.length;i++) line+=` H ${x(i)} V ${y(values[i])}`;
  return <div className="chart-wrap"><svg viewBox="0 0 900 275" role="img" aria-label="Best price history trend" preserveAspectRatio="xMidYMid meet">
    {[0,.25,.5,.75,1].map(f=>{
      const price=lower+(upper-lower)*f;
      return <g key={f}><line x1="75" y1={y(price)} x2="865" y2={y(price)} stroke="#dce8f5" strokeDasharray="3 5"/>
        <text x="64" y={y(price)+4} textAnchor="end" fontSize="12" fill="#5f6c84">{price.toFixed(1)}</text></g>;
    })}
    {targetN!=null&&<g><line x1="75" x2="865" y1={y(targetN)} y2={y(targetN)} stroke="#a16207" strokeDasharray="8 6"/>
      <text x="860" y={y(targetN)-8} textAnchor="end" fontSize="12" fill="#a16207">Target</text></g>}
    <path d={line} stroke="#5576a3" strokeWidth="3" fill="none" strokeLinejoin="round"/>
    <circle cx={x(values.length-1)} cy={y(values[values.length-1])} r="4" fill="#5576a3"/>
    <text x="75" y="260" fill="#5f6c84" fontSize="12">{time(points[0]?.recorded_at)}</text>
    <text x="865" y="260" fill="#5f6c84" fontSize="12" textAnchor="end">{time(points[points.length-1]?.recorded_at)}</text>
  </svg><div className="small muted">Latest best: {money(values[values.length-1],currency)}</div></div>;
}
