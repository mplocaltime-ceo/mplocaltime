/* legal.js - small frontend utilities for legal pages
   Features:
   - Reading progress bar
   - Estimated reading time
   - Scroll to top
   - Print and share helpers
   - Dark mode toggle (prefers-system aware)
   - Sticky behavior for sidebar handled via CSS
*/
(function(){
  'use strict';
  function q(s,root=document){return root.querySelector(s)}
  function qa(s,root=document){return Array.from(root.querySelectorAll(s))}

  // Reading progress
  const prog = document.createElement('div'); prog.className='reading-progress'; document.body.appendChild(prog);
  function onScroll(){
    const h = document.documentElement.scrollHeight - window.innerHeight; if (h<=0) {prog.style.width='0%'; return}
    const pct = Math.min(100, Math.round(window.scrollY / h * 100)); prog.style.width = pct + '%';
  }
  window.addEventListener('scroll', onScroll, {passive:true}); onScroll();

  // Estimated reading time
  qa('article').forEach(article=>{
    const text = article.innerText || ''; const words = text.trim().split(/\s+/).length || 0; const minutes = Math.max(1, Math.round(words/200));
    const el = document.createElement('div'); el.className='meta-small'; el.textContent = `${minutes} min read`; article.prepend(el);
  });

  // Scroll to top
  const topBtn = document.createElement('button'); topBtn.className='top-btn'; topBtn.title='Back to top'; topBtn.innerHTML='↑';
  topBtn.addEventListener('click', ()=> window.scrollTo({top:0,behavior:'smooth'})); document.body.appendChild(topBtn);

  // Print button handler
  window.bindPrint = function(el){ el && el.addEventListener('click', ()=> window.print()); };

  // Copy Link
  window.copyLink = function(){ navigator.clipboard.writeText(location.href).then(()=> alert('Link copied to clipboard')); };

  // Share
  window.sharePage = function(){ if (navigator.share){ navigator.share({title:document.title,text:document.querySelector('meta[name=description]')?.content||'',url:location.href}); } else { window.copyLink(); }};

  // Dark mode toggle
  window.toggleDark = function(){ const dark = document.documentElement.getAttribute('data-theme')==='dark'; document.documentElement.setAttribute('data-theme', dark ? 'light':'dark'); };

})();
