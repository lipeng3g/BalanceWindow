import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Toast } from '@douyinfe/semi-ui';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthSideSheet from '@/components/auth/AuthSideSheet';

const { fetchProviders, signInSocial } = vi.hoisted(() => ({
  fetchProviders: vi.fn(),
  signInSocial: vi.fn(),
}));

vi.mock('@douyinfe/semi-ui', () => ({
  Banner: ({ description }: { description: ReactNode }) => <div>{description}</div>,
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <button type="button" aria-label={ariaLabel} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  SideSheet: ({
    visible,
    title,
    children,
    footer,
  }: {
    visible: boolean;
    title: ReactNode;
    children: ReactNode;
    footer: ReactNode;
  }) => visible ? (
    <section>
      <h2>{title}</h2>
      {children}
      <footer>{footer}</footer>
    </section>
  ) : null,
  Spin: () => <span>loading</span>,
  Toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/authClient', () => ({
  authClient: {
    signIn: { social: signInSocial },
  },
  fetchAuthProviders: fetchProviders,
}));

describe('AuthSideSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('只展示服务端已配置的社交登录方式', async () => {
    fetchProviders.mockResolvedValue({ github: true, google: false });
    render(<AuthSideSheet visible onClose={vi.fn()} />);

    expect(screen.getByText('登录 Balance Window')).toBeInTheDocument();
    expect(screen.getByText('授权登录不会上传本地资金数据')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '使用 GitHub 登录' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '使用 Google 登录' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('name@example.com')).not.toBeInTheDocument();
  });

  it('没有配置 Provider 时保留可用的游客模式提示', async () => {
    fetchProviders.mockResolvedValue({ github: false, google: false });
    render(<AuthSideSheet visible onClose={vi.fn()} />);

    expect(await screen.findByText(/社交账号授权正在配置中/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂不登录' })).toBeInTheDocument();
  });

  it('使用正式地址发起 GitHub OAuth', async () => {
    fetchProviders.mockResolvedValue({ github: true, google: true });
    signInSocial.mockResolvedValue({ data: { redirect: true }, error: null });
    render(<AuthSideSheet visible onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: '使用 GitHub 登录' }));

    await waitFor(() => {
      expect(signInSocial).toHaveBeenCalledWith({
        provider: 'github',
        callbackURL: `${window.location.origin}/`,
        newUserCallbackURL: `${window.location.origin}/`,
        errorCallbackURL: `${window.location.origin}/?auth=oauth-error`,
      });
    });
  });

  it('授权入口失败时提示错误且允许重试', async () => {
    const error = vi.spyOn(Toast, 'error').mockImplementation(() => '');
    fetchProviders.mockResolvedValue({ github: true, google: false });
    signInSocial.mockResolvedValue({ data: null, error: { message: 'provider unavailable' } });
    render(<AuthSideSheet visible onClose={vi.fn()} />);

    const button = await screen.findByRole('button', { name: '使用 GitHub 登录' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith('暂时无法开始授权登录，请稍后重试');
      expect(button).toBeEnabled();
    });
  });
});
