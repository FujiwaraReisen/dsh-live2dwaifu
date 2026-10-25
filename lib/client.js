;(() => {
  const makeFactory = (require) => {
    const react = require('react');
    const h = react.createElement;
    const name = 'dsh-live2d';
    const inject = ['slots'];

    const BASE = '/dsh-live2d';
    const BGS = ['none', 'dark', 'light', 'paper'];
    const BG_LABEL = { none: '透明', dark: '深色', light: '浅色', paper: '纸质' };
    const SHEET_TITLE = { tone: '音色', persona: '人设卡', corpus: '语料' };

    const CSS = `
      .dsh-l2d-card{position:fixed;right:18px;bottom:18px;z-index:9000;border-radius:16px;overflow:hidden;
        border:1px solid rgba(255,255,255,.07);
        background:linear-gradient(180deg,rgba(36,41,50,.95) 0%,rgba(21,24,30,.97) 100%);
        box-shadow:0 18px 48px rgba(0,0,0,.5);backdrop-filter:blur(10px);
        font:12px/1.5 "Microsoft YaHei",system-ui,sans-serif;display:flex;flex-direction:column;
        transition:box-shadow .2s ease}
      .dsh-l2d-card:hover{box-shadow:0 22px 58px rgba(0,0,0,.58)}
      .dsh-l2d-card.collapsed{width:150px!important;height:38px!important}
      .dsh-l2d-head{display:flex;align-items:center;gap:7px;padding:9px 11px 9px 24px;color:#a8b1bf;font-size:11px;
        letter-spacing:.4px;border-bottom:1px solid rgba(255,255,255,.06);user-select:none;flex:none;cursor:move;
        background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,0))}
      .dsh-l2d-dot{width:7px;height:7px;border-radius:50%;background:#6aa9ff;flex:none;
        box-shadow:0 0 0 3px rgba(106,169,255,.16)}
      .dsh-l2d-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d7dde7}
      .dsh-l2d-btns{margin-left:auto;display:flex;gap:2px;flex:none}
      .dsh-l2d-btns button{background:none;border:0;color:#7d858f;font:inherit;cursor:pointer;
        width:22px;height:22px;border-radius:7px;padding:0;line-height:1;
        display:flex;align-items:center;justify-content:center;
        transition:background .15s ease,color .15s ease}
      .dsh-l2d-btns button:hover{color:#eef2f8;background:rgba(255,255,255,.09)}
      .dsh-l2d-body{display:block;width:100%;flex:1;border:0;background:transparent}
      .dsh-l2d-say{display:flex;gap:7px;padding:8px 10px;border-top:1px solid rgba(255,255,255,.06);flex:none}
      .dsh-l2d-say input{flex:1;min-width:0;background:rgba(255,255,255,.05);
        border:1px solid rgba(255,255,255,.09);border-radius:10px;color:#e6ebf2;
        font:inherit;font-size:11.5px;padding:7px 10px;outline:none;
        transition:border-color .15s ease,background .15s ease}
      .dsh-l2d-say input::placeholder{color:#6d7684}
      .dsh-l2d-say input:focus{border-color:rgba(106,169,255,.55);background:rgba(255,255,255,.08)}
      .dsh-l2d-send{background:linear-gradient(180deg,#33587f,#27405f);border:1px solid #3e6b9e;
        border-radius:10px;color:#eaf2ff;font:inherit;cursor:pointer;padding:0 13px;font-size:11.5px;
        transition:filter .15s ease}
      .dsh-l2d-send:hover{filter:brightness(1.14)}
      .dsh-l2d-send:active{filter:brightness(.96)}
      .dsh-l2d-grip{position:absolute;left:0;top:0;width:20px;height:20px;cursor:nwse-resize;opacity:.4;
        transition:opacity .15s ease,background .15s ease;border-radius:16px 0 8px 0;z-index:2;
        background:repeating-linear-gradient(135deg,transparent 0 2px,rgba(255,255,255,.45) 2px 3px) no-repeat left top/10px 10px}
      .dsh-l2d-grip:hover{opacity:1;background-color:rgba(255,255,255,.08)}
      .dsh-l2d-sheet{position:fixed;inset:0;z-index:9500;background:rgba(10,12,16,.74);
        backdrop-filter:blur(4px);display:flex;flex-direction:column;padding:18px 18px 22px}
      .dsh-l2d-sheet-bar{display:flex;align-items:center;gap:10px;padding:0 0 10px;
        color:#cfd6e2;font-size:12px;letter-spacing:.5px}
      .dsh-l2d-sheet-bar span{margin-right:auto}
      .dsh-l2d-sheet-bar button{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13);
        border-radius:8px;color:#dfe4ec;font:inherit;font-size:11px;padding:5px 12px;cursor:pointer}
      .dsh-l2d-sheet-bar button:hover{background:rgba(255,255,255,.16)}
      .dsh-l2d-sheet-body{flex:1;border:0;border-radius:14px;background:#12141a;
        box-shadow:0 24px 60px rgba(0,0,0,.6)}
      .dsh-l2d-card.resizing{cursor:nwse-resize;box-shadow:0 0 0 1px rgba(106,169,255,.45),0 22px 58px rgba(0,0,0,.6)}
      .dsh-l2d-card.moving{cursor:move;box-shadow:0 0 0 1px rgba(106,169,255,.35),0 22px 58px rgba(0,0,0,.6)}
    `;

    function ensureCss() {
      if (document.getElementById('dsh-l2d-css')) return;
      const s = document.createElement('style');
      s.id = 'dsh-l2d-css';
      s.textContent = CSS;
      document.head.appendChild(s);
    }

    function readSize() {
      try {
        const s = JSON.parse(localStorage.getItem('dsh-l2d-size') || '{}');
        return { w: Number(s.w) || 300, h: Number(s.h) || 430 };
      } catch {
        return { w: 300, h: 430 };
      }
    }

    function readPos() {
      try {
        const p = JSON.parse(localStorage.getItem('dsh-l2d-pos') || '{}');
        return { x: Number(p.x) || 0, y: Number(p.y) || 0 };
      } catch {
        return { x: 0, y: 0 };
      }
    }

    function Panel() {
      const [open, setOpen] = react.useState(() => localStorage.getItem('dsh-l2d-open') !== '0');
      const [title, setTitle] = react.useState('Live2D');
      const [bg, setBg] = react.useState(() => localStorage.getItem('dsh-l2d-bg') || 'none');
      const [size, setSize] = react.useState(readSize);
      const [pos, setPos] = react.useState(readPos);
      const [draft, setDraft] = react.useState('');
      const [busy, setBusy] = react.useState(false);
      const [sheet, setSheet] = react.useState(null);
      react.useEffect(() => {
        const onMsg = (e) => {
          const d = e.data || {};
          if (d.type === 'dsh-live2d/open' && d.sheet) setSheet(String(d.sheet));
        };
        window.addEventListener('message', onMsg);
        return () => window.removeEventListener('message', onMsg);
      }, []);
      const [nonce, setNonce] = react.useState(0);
      const ref = react.useRef(null);

      react.useEffect(() => localStorage.setItem('dsh-l2d-open', open ? '1' : '0'), [open]);
      react.useEffect(() => localStorage.setItem('dsh-l2d-bg', bg), [bg]);
      react.useEffect(() => localStorage.setItem('dsh-l2d-size', JSON.stringify(size)), [size]);
      react.useEffect(() => localStorage.setItem('dsh-l2d-pos', JSON.stringify(pos)), [pos]);
      react.useEffect(() => {
        frameWin = (ref.current && ref.current.contentWindow) || null;
      }, [nonce, open]);
      react.useEffect(() => {
        let seq = null;
        let stop = false;
        const tick = () => {
          if (stop) return;
          fetch(BASE + '/api/poll?since=' + (seq === null ? 0 : seq))
            .then((r) => r.json())
            .then((d) => {
              if (stop) return;
              if (seq === null) {
                seq = Number(d.seq) || 0;
                return;
              }
              seq = Number(d.seq) || seq;
              const items = d.items || [];
              for (let i = 0; i < items.length; i++) {
                if (!frameWin) break;
                try {
                  frameWin.postMessage(
                    {
                      type: 'dsh-live2d/say',
                      text: items[i].text || '',
                      mood: items[i].mood,
                      image: items[i].image,
                      choices: items[i].choices,
                    },
                    '*',
                  );
                } catch {}
              }
            })
            .catch(() => {});
        };
        tick();
        const id = setInterval(tick, 2500);
        return () => {
          stop = true;
          clearInterval(id);
        };
      }, []);
      react.useEffect(() => {
        if (ref.current && ref.current.contentWindow) {
          ref.current.contentWindow.postMessage({ type: 'dsh-live2d/bg', bg }, '*');
        }
      }, [bg, nonce]);

      react.useEffect(() => {
        fetch(BASE + '/api/models')
          .then((r) => r.json())
          .then((d) => {
            const m = (d.models || []).find((x) => x.id === d.selected) || (d.models || [])[0];
            setTitle(m ? m.name || m.id : '还没有模型');
          })
          .catch(() => setTitle('Live2D'));
      }, [nonce]);

      // 拖动时盖一层全屏透明遮罩：既挡住 iframe 吃事件，也保证 pointermove 一定落在父窗口
      const beginDrag = (e, kind) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const cardEl = e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest('.dsh-l2d-card') : null;
        const sx = e.clientX;
        const sy = e.clientY;
        const w0 = size.w;
        const h0 = size.h;
        const x0 = pos.x;
        const y0 = pos.y;
        const cls = kind === 'resize' ? 'resizing' : 'moving';
        const shield = document.createElement('div');
        shield.setAttribute('data-dsh-l2d-shield', '1');
        shield.style.cssText =
          'position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;background:transparent;touch-action:none;cursor:' +
          (kind === 'resize' ? 'nwse-resize' : 'move');
        document.body.appendChild(shield);
        if (cardEl && cardEl.classList) cardEl.classList.add(cls);

        const move = (ev) => {
          if (kind === 'resize') {
            const maxW = Math.max(240, Math.min(760, window.innerWidth - 40));
            const maxH = Math.max(240, window.innerHeight - 60);
            const w = Math.max(200, Math.min(maxW, w0 + (sx - ev.clientX)));
            const hh = Math.max(200, Math.min(maxH, h0 + (sy - ev.clientY)));
            setSize({ w: Math.round(w), h: Math.round(hh) });
          } else {
            setPos({ x: Math.round(x0 + (ev.clientX - sx)), y: Math.round(y0 + (ev.clientY - sy)) });
          }
        };

        const finish = () => {
          shield.removeEventListener('pointermove', move);
          if (shield.parentNode) shield.parentNode.removeChild(shield);
          if (cardEl && cardEl.classList) cardEl.classList.remove(cls);
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', finish);
          window.removeEventListener('pointercancel', finish);
        };

        shield.addEventListener('pointermove', move);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
      };

      const startDrag = (e) => beginDrag(e, 'resize');
      const startMove = (e) => beginDrag(e, 'move');
      const noDrag = (e) => e.stopPropagation();

      const manage = () => ref.current && ref.current.contentWindow.postMessage({ type: 'dsh-live2d/manage' }, '*');
      const openTone = () => setSheet('tone');
      const openPersona = () => setSheet('persona');

      const send = () => {
        const t = draft.trim();
        if (!t || busy) return;
        setBusy(true);
        setDraft('');
        fetch(BASE + '/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: t }),
        })
          .then((r) => r.json())
          .then((d) => {
            if ((d.reply || d.image) && frameWin) {
              try {
                frameWin.postMessage(
                  { type: 'dsh-live2d/say', text: d.reply || '', image: d.image, choices: d.choices },
                  '*',
                );
              } catch {}
            }
          })
          .catch(() => {})
          .finally(() => setBusy(false));
      };
      const cycleBg = () => setBg(BGS[(BGS.indexOf(bg) + 1) % BGS.length]);

      const cardStyle = open
        ? { width: size.w + 'px', height: size.h + 'px', transform: 'translate(' + pos.x + 'px,' + pos.y + 'px)' }
        : { transform: 'translate(' + pos.x + 'px,' + pos.y + 'px)' };

      const overlay = sheet
        ? h(
            'div',
            { className: 'dsh-l2d-sheet', onPointerDown: noDrag },
            h(
              'div',
              { className: 'dsh-l2d-sheet-bar' },
              h('span', null, SHEET_TITLE[sheet] || sheet),
              h('button', { onClick: () => setSheet(null) }, '关掉'),
            ),
            h('iframe', { className: 'dsh-l2d-sheet-body', src: BASE + '/' + sheet }),
          )
        : null;

      const card = h(
        'div',
        { className: 'dsh-l2d-card' + (open ? '' : ' collapsed'), style: cardStyle },
        h(
          'div',
          { className: 'dsh-l2d-head', onPointerDown: startMove },
          h('span', { className: 'dsh-l2d-dot' }),
          h('span', { className: 'dsh-l2d-name' }, title),
          h(
            'span',
            { className: 'dsh-l2d-btns' },
            open && h('button', { title: '模型管理', onPointerDown: noDrag, onClick: manage }, '⚙'),
            open && h('button', { title: '背景：' + BG_LABEL[bg], onPointerDown: noDrag, onClick: cycleBg }, '◐'),
            open && h('button', { title: '音色', onPointerDown: noDrag, onClick: openTone }, '♪'),
            open && h('button', { title: '人设卡', onPointerDown: noDrag, onClick: openPersona }, '✎'),
            open && h('button', { title: '刷新', onPointerDown: noDrag, onClick: () => setNonce((n) => n + 1) }, '↻'),
            h('button', { title: open ? '收起' : '展开', onPointerDown: noDrag, onClick: () => setOpen(!open) }, open ? '⌄' : '⌃'),
          ),
        ),
        open
          ? h('iframe', {
              key: nonce,
              ref,
              className: 'dsh-l2d-body',
              src: BASE + '/viewer?embed=1&bg=' + encodeURIComponent(bg),
              allow: 'autoplay',
              onLoad: () => {
                frameWin = (ref.current && ref.current.contentWindow) || null;
              },
            })
          : null,
        open
          ? h(
              'div',
              { className: 'dsh-l2d-say' },
              h('input', {
                className: 'dsh-l2d-input',
                placeholder: busy ? '……' : '跟她说一句',
                value: draft,
                onPointerDown: noDrag,
                onChange: (e) => setDraft(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter') send();
                },
              }),
              h('button', { className: 'dsh-l2d-send', onPointerDown: noDrag, onClick: send }, '说'),
            )
          : null,
        open ? h('div', { className: 'dsh-l2d-grip', onPointerDown: startDrag, title: '拖动改大小' }) : null,
      );

      return h(react.Fragment, null, card, overlay);
    }

    let frameWin = null;
    let lastSaid = '';
    let lastSaidAt = 0;

    const MOOD_HINTS = [
      ['生气', ['气', '烦', '讨厌', '凭什么']],
      ['委屈', ['委屈', '难过', '对不起', '哭']],
      ['害羞', ['唔', '别看', '害羞', '脸红']],
      ['开心', ['谢谢', '喜欢', '开心', '好耶']],
      ['困', ['困', '睡', '熬夜']],
    ];

    function guessMood(text) {
      for (let i = 0; i < MOOD_HINTS.length; i++) {
        const words = MOOD_HINTS[i][1];
        for (let j = 0; j < words.length; j++) {
          if (text.indexOf(words[j]) >= 0) return MOOD_HINTS[i][0];
        }
      }
      return '平静';
    }

    function pushSay(text) {
      const t = String(text || '').replace(/\s+/g, ' ').trim();
      if (!t || t === lastSaid) return;
      if (Date.now() - lastSaidAt < 700) return;
      lastSaid = t;
      lastSaidAt = Date.now();
      if (!frameWin) return;
      try {
        frameWin.postMessage({ type: 'dsh-live2d/say', text: t, mood: guessMood(t) }, '*');
      } catch {}
    }

    function ChatProbe(props) {
      const anchor = react.useRef(null);
      const role =
        (props && (props.role || props.kind)) ||
        (props && props.node && (props.node.role || props.node.kind)) ||
        (props && props.message && props.message.role) ||
        '';
      let followOn = true;
      try {
        followOn = JSON.parse(localStorage.getItem('dsh-l2d-flags') || '{}').follow !== false;
      } catch {
        followOn = true;
      }
      const skip = !followOn || /user|human|prompt/i.test(String(role));
      react.useEffect(() => {
        if (skip) return;
        const el = anchor.current;
        if (!el) return;
        let node = el.parentElement;
        let text = '';
        for (let i = 0; i < 5 && node; i++) {
          const t = (node.textContent || '').trim();
          if (t.length > 3 && t.length < 900) {
            text = t;
            break;
          }
          node = node.parentElement;
        }
        if (text) pushSay(text);
      });
      if (skip) return null;
      return h('i', { ref: anchor, style: { display: 'none' } });
    }

    function apply(ctx) {
      ensureCss();
      ctx.slots.inject('shell.overlay', function* () {
        yield ctx.slots.register({ name: 'shell.overlay', id: 'live2d', order: 900 }, Panel);
      });
      ctx.slots.inject('conversation.chat.node', function* () {
        yield ctx.slots.register({ name: 'conversation.chat.node', id: 'live2d-say', order: 900 }, ChatProbe);
      });
    }

    return { apply, inject, name };
  };

  window.__ModuleLoader__.load({ id: 'dsh-live2dwaifu', factory: makeFactory });
})();
