// The selected learning-space UI is the only production application entry.
// Retain the abandoned UI solely for explicit local historical regression tests.
async function mount(){
 if(import.meta.env.DEV && import.meta.env.VITE_LEGACY_UI==='true'){
  const [{createRoot},{App}]=await Promise.all([import('react-dom/client'),import('./App')]);
  await import('./styles/index.css');await import('./styles/learning.css');
  const container=document.getElementById('root');if(!container)throw new Error('找不到挂载点');
  createRoot(container).render(<App/>);
 }else await import('./preview/main');
}
void mount();
