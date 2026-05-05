import { createContext, useContext, useState, useCallback } from 'react';
import SessionAddModal from '../components/modals/SessionAddModal';

const Ctx = createContext({ open: () => {}, close: () => {} });

export function SessionAddModalProvider({ children }) {
  const [state, setState] = useState({ visible: false, opts: null });
  const open = useCallback((opts = {}) => setState({ visible: true, opts }), []);
  const close = useCallback(() => setState({ visible: false, opts: null }), []);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {state.visible && (
        <SessionAddModal
          {...(state.opts || {})}
          onClose={close}
          onSaved={(data) => {
            close();
            // 페이지가 자체적으로 갱신을 트리거하도록 onSaved 콜백을 props로 받을 수 있음
          }}
        />
      )}
    </Ctx.Provider>
  );
}

export function useSessionAddModal() {
  return useContext(Ctx);
}
