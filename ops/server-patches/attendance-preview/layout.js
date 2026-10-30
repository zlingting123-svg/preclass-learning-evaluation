export function layoutPieces(n){
 let cols=1,best=Infinity;
 for(let c=1;c<=Math.min(n,Math.ceil(Math.sqrt(n)*2));c++){const rows=Math.ceil(n/c),score=Math.abs(Math.log(c/rows/(4/3)))+(c*rows-n)/n*3;if(score<best){cols=c;best=score}}
 const rows=Math.ceil(n/cols),cells=[];let excess=cols*rows-n;
 for(let r=0;r<rows;r++){
  const merges=Math.min(Math.floor(cols/2),Math.ceil(excess/(rows-r)));excess-=merges;
  const spans=[...Array(merges).fill(2),...Array(cols-merges*2).fill(1)];
  if(spans.length){const rotate=r%spans.length;spans.push(...spans.splice(0,rotate))}
  let c=0;for(const span of spans){cells.push({c,r,span});c+=span}
 }
 return {cols,rows,cells};
}
