(() => {
  if (document.getElementById('global-back-to-top')) return;
  const button = document.createElement('button');
  button.id = 'global-back-to-top';
  button.type = 'button';
  button.className = 'global-back-to-top';
  button.setAttribute('aria-label', '回到顶部');
  button.title = '回到顶部';
  button.innerHTML = '<span aria-hidden="true">↑</span><span>顶部</span>';
  button.hidden = true;
  document.body.appendChild(button);
  let target = null;
  const scrollingElement = () => document.scrollingElement || document.documentElement;
  const isPageScroller = el => el instanceof HTMLElement && el.isConnected && el.matches('main, .pv-content, .pv-page, #root') && el.scrollHeight > el.clientHeight + 2;
  const update = () => {
    if (target && !isPageScroller(target)) target = null;
    button.hidden = Math.max(window.scrollY || scrollingElement().scrollTop, target?.scrollTop || 0) < 180;
  };
  document.addEventListener('scroll', e => {
    if (e.target === document || e.target === document.documentElement || e.target === document.body) target = null;
    else if (isPageScroller(e.target)) target = e.target;
    update();
  }, {capture:true, passive:true});
  window.addEventListener('resize', update, {passive:true});
  button.addEventListener('click', () => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (target && isPageScroller(target)) target.scrollTo({top:0, behavior});
    window.scrollTo({top:0, behavior});
  });
  update();
})();
