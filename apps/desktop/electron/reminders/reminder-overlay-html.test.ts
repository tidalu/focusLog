import { describe, expect, it } from 'vitest';

import { buildReminderOverlayHtml } from './reminder-overlay-html.js';

type Listener = () => void;

function element(id: string) {
  const listeners = new Map<string, Listener[]>();
  return {
    id,
    value: '',
    textContent: '',
    disabled: false,
    type: '',
    classList: { toggle: () => undefined },
    style: {},
    children: [] as unknown[],
    addEventListener: (event: string, listener: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    dispatch: (event: string) => {
      for (const listener of listeners.get(event) ?? []) listener();
    },
    focus: () => undefined,
    setSelectionRange: () => undefined,
    replaceChildren: () => undefined,
    append: (child: unknown) => {
      (element(id).children as unknown[]).push(child);
    }
  };
}

describe('reminder overlay html', () => {
  it('updates the visible counter and enables submit when response text changes', () => {
    const html = buildReminderOverlayHtml('occurrence', 5);
    const script = /<script>([\s\S]*?)<\/script>/u.exec(html)?.[1];
    expect(script).toBeDefined();
    expect(html).toContain('oninput="window.__focuslogReminderUpdate');
    expect(html).toContain('pointer-events:none;z-index:0');
    expect(() =>
      Function('window', 'document', 'setTimeout', 'clearTimeout', script!)
    ).not.toThrow();

    const field = element('response');
    const submit = element('submit');
    submit.disabled = true;
    const counter = element('counter');
    const suggestions = element('suggestions');
    const form = element('form');
    const fakeDocument = {
      querySelector: (selector: string) =>
        ({
          '#response': field,
          '#submit': submit,
          '#counter': counter,
          '#suggestions': suggestions,
          '#form': form
        })[selector],
      createElement: (id: string) => element(id),
      body: { classList: { add: () => undefined } }
    };
    const fakeWindow = {
      focuslog: {
        getDraft: () => Promise.reject(new Error('draft unavailable')),
        searchFilters: () => Promise.reject(new Error('filters unavailable')),
        preserveDraft: () => Promise.resolve()
      },
      addEventListener: () => undefined
    };

    Function(
      'window',
      'document',
      'setTimeout',
      'clearTimeout',
      script!
    )(
      fakeWindow,
      fakeDocument,
      (listener: Listener) => {
        listener();
        return 1;
      },
      () => undefined
    );

    field.value = 'Typed response definitely longer than twenty chars';
    field.dispatch('input');

    expect(counter.textContent).toContain('50 / 20');
    expect(submit.disabled).toBe(false);
  });
});
