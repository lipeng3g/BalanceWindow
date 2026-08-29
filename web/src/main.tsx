import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@douyinfe/semi-ui/dist/css/semi.min.css';
import '@/styles/global.css';
import App from '@/App';
import CloudSyncProvider from '@/components/cloud/CloudSyncProvider';
import { I18nProvider } from '@/i18n';

const container = document.getElementById('root');
if (!container) throw new Error('未找到 #root 挂载节点');

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <CloudSyncProvider>
        <App />
      </CloudSyncProvider>
    </I18nProvider>
  </StrictMode>,
);
