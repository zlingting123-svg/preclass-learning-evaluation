(() => {
  const minimum = 15, pending = new Set(); let scheduled = false, resizeTimer;
  const excluded = 'svg, svg *, canvas, script, style, noscript, .katex, .katex *, [aria-hidden="true"], [aria-hidden="true"] *, .sr-only, .visually-hidden, .pv-ai-tag, .tw-entry-index, .att-kicker, .tw-kicker, .sa-eyebrow, .pv-nav-label';
  const textual = /[\p{L}\p{N}]/u;
  function candidate(el) {
    if (!(el instanceof HTMLElement) || el.closest(excluded)) return false;
    if (el.matches('input')) return !['hidden','checkbox','radio','range','color','file','image'].includes(el.type);
    if (el.matches('select,textarea')) return true;
    return [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && textual.test(n.nodeValue || ''));
  }
  function apply(el) {
    if (!candidate(el) || el.classList.contains('ux-readable-text')) return;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px >= 8 && px < minimum) el.classList.add('ux-readable-text');
  }
  function scan(node) {
    if (node.nodeType === Node.TEXT_NODE) return apply(node.parentElement);
    if (!(node instanceof Element)) return;
    apply(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (textual.test(walker.currentNode.nodeValue || '')) apply(walker.currentNode.parentElement);
    node.querySelectorAll('input,select,textarea').forEach(apply);
  }
  function flush(){scheduled=false;const nodes=[...pending];pending.clear();for(const node of nodes)if(node.isConnected)scan(node)}
  function queue(node){if(!node)return;pending.add(node);if(!scheduled){scheduled=true;requestAnimationFrame(flush)}}
  function recheck(){document.querySelectorAll('.ux-readable-text').forEach(el=>el.classList.remove('ux-readable-text'));queue(document.body)}
  new MutationObserver(records=>{for(const r of records){if(r.type==='characterData')queue(r.target);else if(r.type==='attributes'){if(!r.target.classList.contains('ux-readable-text'))queue(r.target)}else for(const n of r.addedNodes)if(n.nodeType===Node.ELEMENT_NODE||n.nodeType===Node.TEXT_NODE)queue(n)}}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
  document.addEventListener('load',e=>{if(e.target instanceof HTMLLinkElement&&e.target.rel==='stylesheet')queue(document.body)},true);
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(recheck,160)},{passive:true});
  queue(document.body);
})();
