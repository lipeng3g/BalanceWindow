import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionFormModal from '@/components/transactions/TransactionFormModal';
import { useStore } from '@/store/useStore';

vi.mock('@douyinfe/semi-ui', () => {
  const Select = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  Select.Option = ({ children }: { children?: ReactNode }) => <span>{children}</span>;

  return {
    Banner: ({ description }: { description?: ReactNode }) => <div>{description}</div>,
    Button: ({ children, onClick, disabled }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => (
      <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
    ),
    DatePicker: () => <div />,
    Input: () => <input />,
    InputNumber: () => <input type="number" />,
    SideSheet: ({ children, visible, footer }: {
      children?: ReactNode;
      visible?: boolean;
      footer?: ReactNode;
    }) => visible ? <div>{children}{footer}</div> : null,
    Radio: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    RadioGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Select,
    Switch: ({ checked, onChange }: { checked?: boolean; onChange?: (value: boolean) => void }) => (
      <button
        type="button"
        aria-label="切换周期重复"
        onClick={() => onChange?.(!checked)}
      />
    ),
    Toast: { error: vi.fn(), warning: vi.fn() },
  };
});

describe('TransactionFormModal', () => {
  beforeEach(() => {
    useStore.getState().resetAll();
    useStore.getState().addAccount({
      name: '现金',
      openingBalance: 0,
      openingDate: '2026-01-01',
    });
  });

  it('开启周期重复后展示逐笔预览并在按钮标明生成数量', async () => {
    render(<TransactionFormModal visible onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '切换周期重复' }));

    expect(await screen.findByRole('table', { name: '生成数据预览' })).toBeInTheDocument();
    expect(screen.getByText('共 12 笔')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成 12 笔' })).toBeInTheDocument();
    expect(screen.getByText(/每 1 个月一次：/)).toBeInTheDocument();
  });
});
