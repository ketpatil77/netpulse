// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from '../src/App';

vi.mock('recharts', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Container, LineChart: Container,
    Line: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
  };
});

afterEach(() => { cleanup(); localStorage.clear(); });

it('keeps saved targets and history during StrictMode effect replay', () => {
  const targets = [{ id: 'saved', url: 'https://example.com', active: false }];
  const results = [{ id: 'ping', targetId: 'saved', timestamp: 1000, latency: 42, status: 'OK' }];
  localStorage.setItem('netpulse_targets', JSON.stringify(targets));
  localStorage.setItem('netpulse_results', JSON.stringify(results));
  render(<StrictMode><App /></StrictMode>);
  expect(screen.getByText('https://example.com')).toBeTruthy();
  expect(screen.getByText('Avg Latency: 42ms')).toBeTruthy();
  expect(JSON.parse(localStorage.getItem('netpulse_targets')!)).toEqual(targets);
  expect(JSON.parse(localStorage.getItem('netpulse_results')!)).toEqual(results);
});

it.each(['not JSON', '{}', 'null'])('recovers from invalid saved targets: %s', (saved) => {
  localStorage.setItem('netpulse_targets', saved);
  render(<StrictMode><App /></StrictMode>);
  expect(JSON.parse(localStorage.getItem('netpulse_targets')!)).toEqual([]);
});
