import { useCallback, useEffect } from 'react';
import { useStore } from '@/store/useStore';

/** 主题切换：联动 settings.theme 与 body[theme-mode]（Semi 暗色模式） */
export function useTheme() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  useEffect(() => {
    const body = document.body;
    if (theme === 'dark') body.setAttribute('theme-mode', 'dark');
    else body.removeAttribute('theme-mode');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, toggleTheme };
}
