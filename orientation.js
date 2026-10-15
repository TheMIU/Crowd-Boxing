(() => {
  const button=document.getElementById('landscapeButton');
  const hint=document.getElementById('rotateHint');
  const fallback=document.getElementById('portraitContinue');
  async function requestLandscape(){
    button.disabled=true;button.textContent='ROTATING…';
    try{
      if(!document.fullscreenElement&&document.documentElement.requestFullscreen){
        try{await document.documentElement.requestFullscreen()}catch{}
      }
      if(window.screen?.orientation?.lock)await window.screen.orientation.lock('landscape');
      if(window.innerWidth<=window.innerHeight)throw new Error('Portrait viewport');
    }catch{
      hint.textContent='Rotate your device sideways or widen this window. You can also continue in this view.';
      fallback.hidden=false;
    }finally{button.disabled=false;button.textContent='TURN TO LANDSCAPE'}
  }
  button.onclick=requestLandscape;
  fallback.onclick=()=>{document.getElementById('rotate').hidden=true};
})();
