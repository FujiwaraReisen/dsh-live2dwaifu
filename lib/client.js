;(() => {
  const makeFactory = (require) => {
    const react = require('react');
    const h = react.createElement;
    const name = 'dsh-live2d';
    const inject = ['slots'];

    const BASE = '/dsh-live2d';
    const BGS = ['none', 'dark', 'light', 'paper'];
    const BG_LABEL = { none: '透明', dark: '深色', light: '浅色', paper: '纸质' };

    const CSS = `
      .dsh-l2d-card{position:fixed;right:16px;bottom:16px;z-index:9000;
        border-radius:14px;overflow:hidden;border:1px solid #33373f;
        background:linear-gradient(180deg,#232830 0%,#171a20 100%);
        box-shadow:0 12px 40px rgba(0,0,0,.5);font:12px/1.5 "Microsoft YaHei",system-ui,sans-serif;
        display:flex;flex-direction:column}
      .dsh-l2d-card.collapsed{width:146px!important;height:36px!important}
      .dsh-l2d-head{display:flex;align-items:center;gap:6px;padding:8px 10px;color:#9aa3b0;font-size:11px;
        letter-spacing:.5px;border-bottom:1px solid #2c313a;user-select:none;flex:none;cursor:move}
      .dsh-l2d-dot{width:6px;height:6px;border-radius:50%;background:#6aa9ff;flex:none}
      .dsh-l2d-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dsh-l2d-btns{margin-left:auto;display:flex;gap:6px;flex:none}
      .dsh-l2d-btns button{background:none;border:0;color:#7d858f;font:inherit;cursor:pointer;padding:0 2px;line-height:1}
      .dsh-l2d-btns button:hover{color:#e2e6ee}
      .dsh-l2d-body{display:block;width:100%;flex:1;border:0;background:transparent}
      .dsh-l2d-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;
        background:linear-gradient(135deg,transparent 50%,#3c424c 50%,#3c424c 62%,transparent 62%);
        opacity:.9}
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

      const startDrag = (e) => {
        e.preventDefault();
        const sx = e.clientX;
        const sy = e.clientY;
        const w0 = size.w;
        const h0 = size.h;
        const move = (ev) => {
          const w = Math.max(200, Math.min(720, w0 + (sx - ev.clientX)));
          const hh = Math.max(220, Math.min(window.innerHeight - 80, h0 + (sy - ev.clientY)));
          setSize({ w: Math.round(w), h: Math.round(hh) });
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      };

      const startMove = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const sx = e.clientX;
        const sy = e.clientY;
        const x0 = pos.x;
        const y0 = pos.y;
        const move = (ev) => {
          const nx = x0 + (ev.clientX - sx);
          const ny = y0 + (ev.clientY - sy);
          setPos({ x: Math.round(nx), y: Math.round(ny) });
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      };
      const noDrag = (e) => e.stopPropagation();

      const manage = () => ref.current && ref.current.contentWindow.postMessage({ type: 'dsh-live2d/manage' }, '*');
      const openTone = () => window.open(BASE + '/tone', '_blank', 'width=1140,height=780');
      const cycleBg = () => setBg(BGS[(BGS.indexOf(bg) + 1) % BGS.length]);

      const cardStyle = open
        ? { width: size.w + 'px', height: size.h + 'px', transform: 'translate(' + pos.x + 'px,' + pos.y + 'px)' }
        : { transform: 'translate(' + pos.x + 'px,' + pos.y + 'px)' };

      return h(
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
        open ? h('div', { className: 'dsh-l2d-grip', onPointerDown: startDrag, title: '拖动改大小' }) : null,
      );
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
      const skip = /user|human|prompt/i.test(String(role));
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
