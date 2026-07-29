import { describe, expect, it } from 'vitest';

import {
  defaultWidgetSettings,
  readWidgetSettings,
  updateWidgetSettings
} from './widget-service.js';

describe('desktop widget settings', () => {
  it('defaults to hidden content and safely bounds restored window dimensions', () => {
    expect(readWidgetSettings({})).toEqual(defaultWidgetSettings);
    expect(
      readWidgetSettings({
        widget: { enabled: true, mode: 'insight', privacy: 'full', width: 2, height: 9000 }
      })
    ).toMatchObject({ enabled: true, mode: 'insight', privacy: 'full', width: 340, height: 238 });
  });

  it('persists only supported widget options', () => {
    const values: Record<string, unknown> = {};
    expect(updateWidgetSettings(values, { enabled: true, alwaysOnTop: true })).toMatchObject({
      enabled: true,
      alwaysOnTop: true,
      privacy: 'hidden'
    });
    expect(values.widget).toBeDefined();
  });
});
