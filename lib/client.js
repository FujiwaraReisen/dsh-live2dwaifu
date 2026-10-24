;(() => {
  const makeFactory = () => {
    const react = require('react');
    const h = react.createElement;
    const name = 'dsh-live2d';
    const inject = ['slots'];

    const BASE = '/dsh-live2d';
    const W = 300;
    const H = 430;

    const CSS = `
      .dsh-l2d-card{position:fixed;right:16px;bottom:16px;z-index:9000;width:${W}px;
        border-radius:14px;overflow:hidden;border:1px solid #33373f;
        background:linear-gradient(180deg,#232830 0%,#171a20 100%);
        box-shadow:0 12px 40px rgba(0,0,0,.5);font:12px/1.5 "Microsoft YaHei",system-ui,sans-serif;
        transition:width .18s ease,height .18s ease}
      .dsh-l2d-card.collapsed{width:132px;height:36px}
      .dsh-l2d-head{display:flex;align-items:center;gap:6px;padding:8px 10px;color:#9aa3b0;font-size:11px;
        letter-spacing:.5px;border-bottom:1px solid #2c313a;cursor:default;user-select:none}
      .dsh-l2d-dot{width:6px;height:6px;border-radius:50%;background:#6aa9ff;flex:none}
      .dsh-l2d-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dsh-l2d-btns{margin-left:auto;display:flex;gap:6px;flex:none}
      .dsh-l2d-btns button{background:none;border:0;color:#7d858f;font:inherit;cursor:pointer;padding:0 2px;line-height:1}
      .dsh-l2d-btns button:hover{color:#e2e6ee}
      .dsh-l2d-body{display:block;width:${W}px;height:${H}px;border:0;background:transparent}
    `;

    function ensureCss() {
      if (document.getElementById('dsh-l2d-css')) return;
      const s = document.createElement('style');
      s.id = 'dsh-l2d-css';
      s.textContent = CSS;
      document.head.appendChild(s);
    }

    function Panel() {
      const [open, setOpen] = react.useState(() => localStorage.getItem('dsh-l2d-open') !== '0');
      const [title, setTitle] = react.useState('Live2D');
      const [nonce, setNonce] = react.useState(0);
      const ref = react.useRef(null);

      react.useEffect(() => {
        localStorage.setItem('dsh-l2d-open', open ? '1' : '0');
      }, [open]);

      react.useEffect(() => {
        fetch(BASE + '/api/models')
          .then((r) => r.json())
          .then((d) => {
            const m = (d.models || []).find((x) => x.id === d.selected) || (d.models || [])[0];
            if (m) setTitle(m.name || m.id);
            else setTitle('还没有模型');
          })
          .catch(() => setTitle('Live2D'));
      }, [nonce]);

      const manage = () => ref.current && ref.current.contentWindow.postMessage({ type: 'dsh-live2d/manage' }, '*');

      return h(
        'div',
        { className: 'dsh-l2d-card' + (open ? '' : ' collapsed') },
        h(
          'div',
          { className: 'dsh-l2d-head' },
          h('span', { className: 'dsh-l2d-dot' }),
          h('span', { className: 'dsh-l2d-name' }, title),
          h(
            'span',
            { className: 'dsh-l2d-btns' },
            open && h('button', { title: '模型管理', onClick: manage }, '⚙'),
            open && h('button', { title: '刷新', onClick: () => setNonce((n) => n + 1) }, '↻'),
            h('button', { title: open ? '收起' : '展开', onClick: () => setOpen(!open) }, open ? '⌄' : '⌃'),
          ),
        ),
        open
          ? h('iframe', {
              key: nonce,
              ref,
              className: 'dsh-l2d-body',
              src: BASE + '/viewer?embed=1',
              allow: 'autoplay',
            })
          : null,
      );
    }

    function apply(ctx) {
      ensureCss();
      ctx.slots.inject('shell.overlay', function* () {
        yield ctx.slots.register({ name: 'shell.overlay', id: 'live2d', order: 900 }, Panel);
      });
    }

    return { apply, inject, name };
  };

  window.__ModuleLoader__.load({ id: 'dsh-live2d', factory: makeFactory() });
})();
