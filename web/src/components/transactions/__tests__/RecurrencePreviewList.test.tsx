import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RecurrencePreviewList from '@/components/transactions/RecurrencePreviewList';

describe('RecurrencePreviewList', () => {
  it('常见周期完整展示每一笔日期和金额', () => {
    const dates = ['2026-01-01', '2026-02-01', '2026-03-01'];
    render(<RecurrencePreviewList dates={dates} amount={-400000} />);

    expect(screen.getByText('共 3 笔')).toBeInTheDocument();
    dates.forEach((date) => expect(screen.getByText(date)).toBeInTheDocument());
    expect(screen.getAllByText('-¥4,000.00')).toHaveLength(3);
    const toggle = screen.getByRole('button', { name: '展开预览' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: '收起预览' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('长列表显示首尾并明确中间省略数量', () => {
    const dates = Array.from({ length: 105 }, (_, index) => `2026-${String(index + 1).padStart(3, '0')}`);
    render(<RecurrencePreviewList dates={dates} amount={100} title="待新增数据" />);

    expect(screen.getByRole('table', { name: '待新增数据' })).toBeInTheDocument();
    expect(screen.getByText('中间省略 5 笔')).toBeInTheDocument();
    expect(screen.getByText('2026-001')).toBeInTheDocument();
    expect(screen.getByText('2026-105')).toBeInTheDocument();
    expect(screen.queryByText('2026-081')).not.toBeInTheDocument();
  });
});
